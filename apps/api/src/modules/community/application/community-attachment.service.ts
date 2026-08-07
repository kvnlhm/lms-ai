import { Injectable } from '@nestjs/common';
import { CommunityChannelType, type Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { AuditService } from '../../../shared/audit/audit.service';
import type { StaleUploadReconcilerPort } from '../../../shared/storage/stale-upload.port';

const JENIS = new Map([
  ['image/jpeg', { ext: 'jpg', cocok: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
  ['image/png', { ext: 'png', cocok: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/webp', { ext: 'webp', cocok: (b: Buffer) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }],
  ['video/mp4', { ext: 'mp4', cocok: (b: Buffer) => b.toString('ascii', 4, 8) === 'ftyp' }],
  ['video/webm', { ext: 'webm', cocok: (b: Buffer) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) }],
  ['application/pdf', { ext: 'pdf', cocok: (b: Buffer) => b.toString('ascii', 0, 5) === '%PDF-' }],
] as const);
type MimeLampiran = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/webm' | 'application/pdf';

/** Kolom yang aman dikirim ke klien: `objectKey` sengaja tidak termasuk. */
const pilih = { id: true, originalName: true, mimeType: true, sizeBytes: true, position: true, createdAt: true } satisfies Prisma.CommunityPostAttachmentSelect;

@Injectable()
export class CommunityAttachmentService implements StaleUploadReconcilerPort {
  private readonly config: AppConfig['communityAttachment'];

  constructor(private readonly prisma: PrismaService, config: ConfigService<{ app: AppConfig }, true>, private readonly audit: AuditService) {
    this.config = config.get('app', { infer: true }).communityAttachment;
  }

  // ─────────────────────────────────────────────
  // Unggahan dari composer, sebelum postingannya ada
  // ─────────────────────────────────────────────

  /**
   * Menerima satu berkas yang belum terikat ke postingan mana pun.
   *
   * Composer memanggil ini sambil penulisnya masih mengetik, lalu menyebut
   * id-nya pada `attachmentIds` saat menerbitkan. Alternatifnya — menerbitkan
   * dulu lalu mengunggah — berarti setiap pembaca melihat tulisan tanpa
   * gambarnya selama unggahan berjalan, dan tulisan tanpa gambar itu tinggal
   * selamanya bila unggahannya gagal.
   */
  async uploadDraft(userId: string, stream: Readable, mimeType: string | undefined, originalName: string, contentLength: number | undefined) {
    // Batas yang sama dengan satu postingan. Tanpa ini, membuka dan menutup
    // composer berulang kali adalah cara memenuhi disk tanpa menerbitkan
    // apa pun; penyapu memang membersihkannya, tetapi baru sesudah ambang
    // basi terlewat.
    const menggantung = await this.prisma.communityPostAttachment.count({ where: { uploaderId: userId, postId: null } });
    if (menggantung >= this.config.maxPerPost) {
      throw AppError.validation({ file: [`Selesaikan atau buang unggahan yang tertunda dulu; maksimum ${this.config.maxPerPost} berkas.`] });
    }

    const { objectKey, mime } = await this.simpan(stream, mimeType, contentLength, this.config.maxDraftUploadBytes);
    try {
      const attachment = await this.prisma.communityPostAttachment.create({
        data: { postId: null, uploaderId: userId, objectKey, originalName: this.namaAman(originalName), mimeType: mime, sizeBytes: BigInt(contentLength!) },
        select: pilih,
      });
      return this.sajikan(attachment);
    } catch (error) {
      await rm(join(this.config.storagePath, objectKey), { force: true });
      throw error;
    }
  }

  /** Membuang unggahan yang belum diterbitkan, dari composer. */
  async removeDraft(attachmentId: string, userId: string) {
    const attachment = await this.prisma.communityPostAttachment.findFirst({ where: { id: attachmentId, uploaderId: userId, postId: null } });
    if (!attachment) throw AppError.notFound();
    await this.prisma.communityPostAttachment.delete({ where: { id: attachment.id } });
    await rm(join(this.config.storagePath, attachment.objectKey), { force: true });
  }

  /**
   * Mengikat unggahan ke postingan yang baru dibuat.
   *
   * Dipanggil di dalam transaksi pembuatan postingan supaya postingan tanpa
   * lampirannya tidak pernah sempat terlihat. Hanya menerima baris milik
   * penulis yang sama dan yang memang belum terikat — id milik orang lain,
   * atau id yang sudah dipakai postingan lain, ditolak alih-alih diam-diam
   * dilewati.
   */
  async bind(tx: Prisma.TransactionClient, postId: string, userId: string, attachmentIds: string[]) {
    if (attachmentIds.length === 0) return;
    if (attachmentIds.length > this.config.maxPerPost) {
      throw AppError.validation({ attachmentIds: [`Maksimum ${this.config.maxPerPost} lampiran per postingan.`] });
    }
    const unik = [...new Set(attachmentIds)];
    if (unik.length !== attachmentIds.length) throw AppError.validation({ attachmentIds: ['Ada lampiran yang disebut lebih dari sekali.'] });

    const milik = await tx.communityPostAttachment.findMany({ where: { id: { in: unik }, uploaderId: userId, postId: null }, select: { id: true } });
    if (milik.length !== unik.length) throw AppError.validation({ attachmentIds: ['Lampiran tidak ditemukan atau sudah dipakai postingan lain.'] });

    // Satu perintah per baris, bukan `updateMany`: posisinya berbeda-beda dan
    // urutan yang dipilih penulisnya adalah bagian dari isi postingan.
    for (const [position, id] of unik.entries()) {
      await tx.communityPostAttachment.update({ where: { id }, data: { postId, position } });
    }
  }

  // ─────────────────────────────────────────────
  // Lampiran checklist: tetap satu berkas
  // ─────────────────────────────────────────────

  private async postChecklist(postId: string, userId: string, canModerate: boolean) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { type: CommunityChannelType.CHECKLIST, archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, authorId: true, attachments: { select: { id: true, objectKey: true } } },
    });
    if (!post) throw AppError.notFound();
    if (post.authorId !== userId && !canModerate) throw AppError.permissionDenied();
    return post;
  }

  /**
   * Mengunggah atau mengganti lampiran satu item checklist.
   *
   * Checklist tetap berlampir satu berkas walau modelnya kini jamak: ia adalah
   * langkah yang dibaca berurutan, bukan postingan bebas. Karena itu unggahan
   * baru membuang seluruh lampiran lama alih-alih menambah.
   */
  async upload(postId: string, userId: string, canModerate: boolean, stream: Readable, mimeType: string | undefined, originalName: string, contentLength: number | undefined) {
    const post = await this.postChecklist(postId, userId, canModerate);
    const { objectKey, mime } = await this.simpan(stream, mimeType, contentLength, this.config.maxUploadBytes);

    let attachment;
    try {
      attachment = await this.prisma.$transaction(async (tx) => {
        await tx.communityPostAttachment.deleteMany({ where: { postId } });
        return tx.communityPostAttachment.create({
          data: { postId, uploaderId: userId, objectKey, originalName: this.namaAman(originalName), mimeType: mime, sizeBytes: BigInt(contentLength!) },
          select: pilih,
        });
      });
    } catch (error) {
      await rm(join(this.config.storagePath, objectKey), { force: true });
      throw error;
    }
    // Berkas lama dibuang sesudah barisnya hilang. Terbalik, dan proses yang
    // mati di antara keduanya meninggalkan baris yang menunjuk berkas yang
    // sudah tidak ada — kegagalan yang baru terlihat saat pembaca membukanya.
    for (const lama of post.attachments) {
      if (lama.objectKey !== objectKey) await rm(join(this.config.storagePath, lama.objectKey), { force: true });
    }
    await this.audit.record({ actorUserId: userId, action: 'community.checklist_attachment.update', targetType: 'CommunityPost', targetId: postId, after: { mimeType: mime, sizeBytes: String(contentLength) } });
    return this.sajikan(attachment);
  }

  async remove(postId: string, userId: string, canModerate: boolean) {
    await this.postChecklist(postId, userId, canModerate);
    const attachments = await this.prisma.communityPostAttachment.findMany({ where: { postId } });
    if (attachments.length === 0) return;
    await this.prisma.communityPostAttachment.deleteMany({ where: { postId } });
    for (const attachment of attachments) {
      await rm(join(this.config.storagePath, attachment.objectKey), { force: true });
      await this.audit.record({ actorUserId: userId, action: 'community.checklist_attachment.delete', targetType: 'CommunityPost', targetId: postId, before: { mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes.toString() } });
    }
  }

  // ─────────────────────────────────────────────
  // Penyajian
  // ─────────────────────────────────────────────

  /** Lampiran checklist, dirujuk lewat postingannya. */
  async authorised(postId: string) {
    const attachment = await this.prisma.communityPostAttachment.findFirst({
      where: { postId, post: { deletedAt: null, channel: { type: CommunityChannelType.CHECKLIST, archivedAt: null, group: { archivedAt: null } } } },
      orderBy: { position: 'asc' },
    });
    if (!attachment) throw AppError.notFound();
    return attachment;
  }

  /**
   * Lampiran postingan biasa, dirujuk lewat id lampirannya sendiri.
   *
   * Unggahan yang belum diterbitkan hanya dapat dibaca pengunggahnya — pratinjau
   * di composer memakai jalur ini, dan sampai diterbitkan berkas itu belum
   * menjadi milik komunitas.
   */
  async authorisedById(attachmentId: string, userId: string) {
    const attachment = await this.prisma.communityPostAttachment.findFirst({
      where: {
        id: attachmentId,
        OR: [
          { post: { deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } } },
          { postId: null, uploaderId: userId },
        ],
      },
    });
    if (!attachment) throw AppError.notFound();
    return attachment;
  }

  // ─────────────────────────────────────────────
  // Penyapuan
  // ─────────────────────────────────────────────

  /**
   * Membuang unggahan yang tidak pernah diterbitkan.
   *
   * Composer yang ditutup begitu saja meninggalkan baris tanpa `postId` beserta
   * berkasnya. Berbeda dengan berkas `.uploading`, keduanya utuh dan tidak
   * dapat dikenali penyapu berkas — hanya ketiadaan `postId` yang
   * membedakannya, dan itu hanya diketahui basis data.
   */
  async closeStaleUploads(batas: Date): Promise<number> {
    const basi = await this.prisma.communityPostAttachment.findMany({
      where: { postId: null, createdAt: { lt: batas } },
      select: { id: true, objectKey: true },
    });
    if (basi.length === 0) return 0;
    await this.prisma.communityPostAttachment.deleteMany({ where: { id: { in: basi.map((row) => row.id) } } });
    for (const row of basi) await rm(join(this.config.storagePath, row.objectKey), { force: true });
    return basi.length;
  }

  // ─────────────────────────────────────────────
  // Bersama
  // ─────────────────────────────────────────────

  /**
   * Menulis berkas ke disk dan mengembalikan kuncinya.
   *
   * Jenisnya tidak dipercayakan pada header `Content-Type`: byte awal berkas
   * diperiksa terhadap tanda tangan jenis yang dinyatakan, dan berkas hanya
   * di-`rename` ke tempat akhirnya sesudah seluruhnya lolos.
   */
  private async simpan(stream: Readable, mimeType: string | undefined, contentLength: number | undefined, batasByte: number) {
    const jenis = mimeType ? JENIS.get(mimeType as MimeLampiran) : undefined;
    if (!jenis) throw AppError.validation({ file: ['Gunakan JPG, PNG, WebP, MP4, WebM, atau PDF.'] });
    if (!contentLength || contentLength < 1 || contentLength > batasByte) {
      throw AppError.validation({ file: [`Ukuran berkas harus antara 1 byte dan ${batasByte} byte.`] });
    }

    const objectKey = `${randomUUID()}.${jenis.ext}`;
    const temporaryPath = join(this.config.storagePath, `${objectKey}.uploading`);
    const finalPath = join(this.config.storagePath, objectKey);
    await mkdir(this.config.storagePath, { recursive: true, mode: 0o755 });
    await chmod(this.config.storagePath, 0o755);
    let bytes = 0;
    let awal = Buffer.alloc(0);
    const pemeriksa = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > contentLength) return callback(new Error('Unggahan melebihi ukuran yang dinyatakan.'));
      if (awal.length < 16) awal = Buffer.concat([awal, chunk]).subarray(0, 16);
      callback(null, chunk);
    } });
    try {
      await pipeline(stream, pemeriksa, createWriteStream(temporaryPath, { flags: 'wx', mode: 0o644 }));
      if (bytes !== contentLength || !jenis.cocok(awal)) throw new Error('Isi berkas tidak sesuai dengan jenisnya.');
      await rename(temporaryPath, finalPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw AppError.validation({ file: [error instanceof Error ? error.message : 'Unggahan gagal.'] });
    }
    return { objectKey, mime: mimeType as MimeLampiran };
  }

  private namaAman(name: string) { return name.replace(/[^\w.\- ]/g, '_').slice(0, 255) || 'lampiran'; }
  private sajikan(value: { id: string; originalName: string; mimeType: string; sizeBytes: bigint; position: number; createdAt: Date }) {
    return { id: value.id, originalName: value.originalName, mimeType: value.mimeType, sizeBytes: value.sizeBytes.toString(), position: value.position, createdAt: value.createdAt };
  }
}
