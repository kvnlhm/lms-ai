import { Inject, Injectable } from '@nestjs/common';
import { CommunityChannelType, type Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { PassThrough, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type OutputInfo } from 'sharp';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { AuditService } from '../../../shared/audit/audit.service';
import { olahGambar } from '../../../shared/storage/image-processing';
import { bunnySignedUrl } from '../../video/application/video.service';
import { VIDEO_PROVISIONER, type VideoProvisionerPort } from '../../video/application/video-provisioning.port';
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
const pilih = {
  id: true, originalName: true, mimeType: true, sizeBytes: true, position: true,
  createdAt: true, width: true, height: true,
  // Diambil bersama lampirannya, bukan lewat kueri tambahan per baris: satu
  // umpan dapat memuat puluhan lampiran sekaligus.
  videoAsset: { select: { id: true, status: true, provider: true, providerVideoId: true } },
} satisfies Prisma.CommunityPostAttachmentSelect;

/**
 * Sisi terpanjang gambar sesudah diolah.
 *
 * Kartu umpan paling lebar beberapa ratus piksel dan lightbox memakai lebar
 * layar; 1600 menutupi keduanya termasuk pada layar 2x. Yang dikirim ponsel
 * biasanya empat ribu piksel lebih, dan seluruh kelebihan itu diunduh pembaca
 * hanya untuk dibuang oleh penskalaan browser.
 */
const SISI_MAKS = 1600;

/** Status video yang tidak akan berubah lagi. */
const VIDEO_TERMINAL = new Set(['AVAILABLE', 'FAILED', 'DELETED']);

/**
 * Batas aset yang ditanyakan ke penyedia dalam satu pembacaan.
 *
 * Satu umpan dapat memuat puluhan lampiran; tanpa batas ini, membuka halaman
 * komunitas berubah menjadi puluhan permintaan keluar. Sisanya menyusul pada
 * pembacaan berikutnya, dan itu cukup — transcode memang butuh waktu.
 */
const MAKS_SELARAS_SEKALI = 10;

@Injectable()
export class CommunityAttachmentService implements StaleUploadReconcilerPort {
  private readonly config: AppConfig['communityAttachment'];
  private readonly video: AppConfig['video'];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<{ app: AppConfig }, true>,
    private readonly audit: AuditService,
    @Inject(VIDEO_PROVISIONER) private readonly penyedia: VideoProvisionerPort,
  ) {
    const app = config.get('app', { infer: true });
    this.config = app.communityAttachment;
    this.video = app.video;
  }

  /**
   * Menghapus berkas milik sebuah lampiran, bila memang ada.
   *
   * Lampiran video kini dititipkan ke Bunny Stream dan `objectKey`-nya kosong;
   * tidak ada yang perlu dihapus di volume kita. Penjaga null ini sengaja
   * berada di satu tempat supaya setiap jalur penghapusan mewarisinya.
   */
  async removeObject(objectKey: string | null): Promise<void> {
    if (!objectKey) return;
    await rm(join(this.config.storagePath, objectKey), { force: true });
  }

  /**
   * Membuang isi sebuah lampiran, di mana pun ia disimpan.
   *
   * Satu pintu untuk kedua jenis: berkas di volume kita, atau aset video di
   * penyedia luar. Jalur penghapusan mana pun cukup memanggil ini, sehingga
   * tidak ada yang perlu diingat memanggil dua hal berbeda — dan video yang
   * terlupakan di penyedia tetap ditagih walau tidak ada yang menunjuknya.
   */
  async buangIsi(lampiran: { objectKey: string | null; videoAssetId?: string | null }): Promise<void> {
    await this.removeObject(lampiran.objectKey);
    if (lampiran.videoAssetId) await this.penyedia.hapus(lampiran.videoAssetId);
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

    const { objectKey, mime, sizeBytes, width, height } = await this.simpan(stream, mimeType, contentLength, this.config.maxDraftUploadBytes);
    try {
      const attachment = await this.prisma.communityPostAttachment.create({
        data: { postId: null, uploaderId: userId, objectKey, originalName: this.namaAman(originalName), mimeType: mime, sizeBytes, width, height },
        select: pilih,
      });
      return this.sajikan(attachment);
    } catch (error) {
      await rm(join(this.config.storagePath, objectKey), { force: true });
      throw error;
    }
  }

  /**
   * Menyiapkan lampiran video: aset di penyedia, izinnya, dan baris drafnya.
   *
   * Bytenya tidak pernah melewati VPS ini — peramban mengunggah langsung ke
   * penyedia memakai tiket yang dikembalikan di sini. Itulah seluruh alasan
   * memindahkan video keluar, sama seperti yang sudah dilakukan video kursus.
   *
   * Batas ukuran diperiksa di sini walau berkasnya tidak lewat sini, karena di
   * sinilah satu-satunya tempat kita masih memegang keputusan: sesudah tiketnya
   * keluar, yang menerima unggahan adalah penyedia.
   */
  async siapkanVideo(userId: string, input: { originalName: string; sizeBytes: number }) {
    const batas = this.config.maxDraftUploadBytes;
    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > batas) {
      throw AppError.validation({ sizeBytes: [`Ukuran video harus antara 1 byte dan ${batas} byte.`] });
    }

    // Batas yang sama dengan unggahan berkas. Tanpa ini, membuka dan menutup
    // composer berulang kali adalah cara membuat video tanpa batas di library
    // penyedia — dan setiap video di sana berbiaya.
    const menggantung = await this.prisma.communityPostAttachment.count({ where: { uploaderId: userId, postId: null } });
    if (menggantung >= this.config.maxPerPost) {
      throw AppError.validation({ file: [`Selesaikan atau buang unggahan yang tertunda dulu; maksimum ${this.config.maxPerPost} berkas.`] });
    }

    const namaAman = this.namaAman(input.originalName);
    const { videoAssetId, tiket } = await this.penyedia.siapkanUnggahan({
      ownerId: userId,
      title: namaAman,
      originalName: namaAman,
    });

    const attachment = await this.prisma.communityPostAttachment.create({
      data: {
        postId: null,
        uploaderId: userId,
        objectKey: null,
        videoAssetId,
        originalName: namaAman,
        mimeType: 'video/mp4',
        sizeBytes: BigInt(input.sizeBytes),
      },
      select: pilih,
    });
    return { attachment: this.sajikan(attachment), tiket };
  }

  /** Mengembalikan draf milik penulis agar composer pulih setelah refresh. */
  async listDrafts(userId: string) {
    const drafts = await this.prisma.communityPostAttachment.findMany({
      where: { uploaderId: userId, postId: null },
      orderBy: { createdAt: 'asc' },
      select: pilih,
    });
    const terkini = await this.selaraskanVideoTertunda(drafts);
    return drafts.map((draft) => this.sajikan(draft, terkini));
  }

  /** Membuang unggahan yang belum diterbitkan, dari composer. */
  async removeDraft(attachmentId: string, userId: string) {
    const attachment = await this.prisma.communityPostAttachment.findFirst({ where: { id: attachmentId, uploaderId: userId, postId: null } });
    if (!attachment) throw AppError.notFound();
    await this.prisma.communityPostAttachment.delete({ where: { id: attachment.id } });
    await this.buangIsi(attachment);
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

  /** Mengganti seluruh lampiran post; id lama boleh dipertahankan, id baru harus unggahan draf penulis. */
  async replace(tx: Prisma.TransactionClient, postId: string, userId: string, attachmentIds: string[]): Promise<{ objectKey: string | null; videoAssetId: string | null }[]> {
    if (attachmentIds.length > this.config.maxPerPost) {
      throw AppError.validation({ attachmentIds: [`Maksimum ${this.config.maxPerPost} lampiran per postingan.`] });
    }
    const unik = [...new Set(attachmentIds)];
    if (unik.length !== attachmentIds.length) throw AppError.validation({ attachmentIds: ['Ada lampiran yang disebut lebih dari sekali.'] });

    const lama = await tx.communityPostAttachment.findMany({ where: { postId }, select: { id: true, objectKey: true, videoAssetId: true } });
    const tersedia = await tx.communityPostAttachment.findMany({
      where: { id: { in: unik }, OR: [{ postId }, { postId: null, uploaderId: userId }] },
      select: { id: true },
    });
    if (tersedia.length !== unik.length) throw AppError.validation({ attachmentIds: ['Lampiran tidak ditemukan atau bukan milik postingan ini.'] });

    await tx.communityPostAttachment.deleteMany({ where: { postId, id: { notIn: unik } } });
    for (const [position, id] of unik.entries()) {
      await tx.communityPostAttachment.update({ where: { id }, data: { postId, position } });
    }
    const dipertahankan = new Set(unik);
    return lama
      .filter((item) => !dipertahankan.has(item.id))
      .map(({ objectKey, videoAssetId }) => ({ objectKey, videoAssetId }));
  }

  // ─────────────────────────────────────────────
  // Lampiran checklist: tetap satu berkas
  // ─────────────────────────────────────────────

  private async postChecklist(postId: string, userId: string, canModerate: boolean) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { type: CommunityChannelType.CHECKLIST, archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, authorId: true, attachments: { select: { id: true, objectKey: true, videoAssetId: true } } },
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
    const { objectKey, mime, sizeBytes, width, height } = await this.simpan(stream, mimeType, contentLength, this.config.maxUploadBytes);

    let attachment;
    try {
      attachment = await this.prisma.$transaction(async (tx) => {
        await tx.communityPostAttachment.deleteMany({ where: { postId } });
        return tx.communityPostAttachment.create({
          data: { postId, uploaderId: userId, objectKey, originalName: this.namaAman(originalName), mimeType: mime, sizeBytes, width, height },
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
      if (lama.objectKey !== objectKey) await this.buangIsi(lama);
    }
    await this.audit.record({ actorUserId: userId, action: 'community.checklist_attachment.update', targetType: 'CommunityPost', targetId: postId, after: { mimeType: mime, sizeBytes: String(sizeBytes) } });
    return this.sajikan(attachment);
  }

  async remove(postId: string, userId: string, canModerate: boolean) {
    await this.postChecklist(postId, userId, canModerate);
    const attachments = await this.prisma.communityPostAttachment.findMany({ where: { postId } });
    if (attachments.length === 0) return;
    await this.prisma.communityPostAttachment.deleteMany({ where: { postId } });
    for (const attachment of attachments) {
      await this.buangIsi(attachment);
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
      select: { id: true, objectKey: true, videoAssetId: true },
    });
    if (basi.length === 0) return 0;
    await this.prisma.communityPostAttachment.deleteMany({ where: { id: { in: basi.map((row) => row.id) } } });
    for (const row of basi) await this.buangIsi(row);
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
   *
   * Gambar diolah ulang sambil mengalir, bukan disimpan mentah: dikecilkan ke
   * `SISI_MAKS` dan dikodekan ulang menjadi WebP. Batas unggahan tetap berlaku
   * pada byte yang masuk — yang berubah hanyalah apa yang mendarat di disk dan
   * karenanya apa yang diunduh setiap pembaca. Pengodean ulang sekaligus
   * membuang EXIF, jadi orientasinya harus diterapkan lebih dulu.
   */
  private async simpan(stream: Readable, mimeType: string | undefined, contentLength: number | undefined, batasByte: number) {
    const jenis = mimeType ? JENIS.get(mimeType as MimeLampiran) : undefined;
    if (!jenis) throw AppError.validation({ file: ['Gunakan JPG, PNG, WebP, MP4, WebM, atau PDF.'] });
    if (!contentLength || contentLength < 1 || contentLength > batasByte) {
      throw AppError.validation({ file: [`Ukuran berkas harus antara 1 byte dan ${batasByte} byte.`] });
    }

    const gambar = mimeType!.startsWith('image/');
    const objectKey = `${randomUUID()}.${gambar ? 'webp' : jenis.ext}`;
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
    const olah = gambar ? olahGambar(SISI_MAKS) : new PassThrough();
    let hasil: OutputInfo | undefined;
    olah.on('info', (info: OutputInfo) => { hasil = info; });
    try {
      await pipeline(stream, pemeriksa, olah, createWriteStream(temporaryPath, { flags: 'wx', mode: 0o644 }));
      if (bytes !== contentLength || !jenis.cocok(awal)) throw new Error('Isi berkas tidak sesuai dengan jenisnya.');
      await rename(temporaryPath, finalPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw AppError.validation({ file: [error instanceof Error ? error.message : 'Unggahan gagal.'] });
    }
    return {
      objectKey,
      mime: (gambar ? 'image/webp' : mimeType) as MimeLampiran,
      // Ukuran berkas yang benar-benar mendarat, bukan yang diunggah: sesudah
      // pengolahan keduanya berbeda, dan angka inilah yang dilihat pembaca.
      sizeBytes: BigInt((await stat(finalPath)).size),
      width: hasil?.width ?? null,
      height: hasil?.height ?? null,
    };
  }

  private namaAman(name: string) { return name.replace(/[^\w.\- ]/g, '_').slice(0, 255) || 'lampiran'; }
  /**
   * Bentuk lampiran yang dikirim ke klien.
   *
   * `video` hanya terisi untuk lampiran yang isinya dititipkan ke penyedia
   * luar. Lampiran berkas lokal mengembalikan `null`, sehingga postingan lama
   * tampil persis seperti sebelumnya selama pemindahan berlangsung.
   */
  /**
   * Menanyakan status terkini video yang masih diproses penyedia.
   *
   * Penyedia tidak mengabari kita ketika transcode selesai, dan tidak ada
   * pekerja yang menanyakannya. Video kursus lolos karena penyelarasannya
   * menumpang pada perpustakaan video yang dibuka Master — tetapi tidak ada
   * Pelajar yang membuka perpustakaan admin. Jadi di komunitas penyelarasan
   * menumpang di sini: tempat pembacanya memang sedang menunggu.
   *
   * Mengembalikan peta id aset ke status terbarunya. Aset yang gagal
   * ditanyakan tidak masuk peta, sehingga status tersimpannya yang dipakai.
   */
  async selaraskanVideoTertunda(
    baris: { videoAsset?: { id: string; status: string } | null }[],
  ): Promise<Map<string, string>> {
    const tertunda = [...new Map(
      baris
        .map((item) => item.videoAsset)
        .filter((aset): aset is { id: string; status: string } => !!aset && !VIDEO_TERMINAL.has(aset.status))
        .map((aset) => [aset.id, aset] as const),
    ).keys()].slice(0, MAKS_SELARAS_SEKALI);

    const terkini = new Map<string, string>();
    await Promise.all(tertunda.map(async (id) => {
      try {
        terkini.set(id, await this.penyedia.selaraskan(id));
      } catch {
        // Penyedia yang sedang tidak dapat dihubungi bukan alasan menjatuhkan
        // halaman yang sedang dibaca orang.
      }
    }));
    return terkini;
  }

  sajikan(value: {
    id: string; originalName: string; mimeType: string; sizeBytes: bigint; position: number;
    createdAt: Date; width: number | null; height: number | null;
    videoAsset?: { id?: string; status: string; providerVideoId: string } | null;
  }, terkini?: Map<string, string>) {
    return {
      id: value.id, originalName: value.originalName, mimeType: value.mimeType,
      sizeBytes: value.sizeBytes.toString(), position: value.position,
      createdAt: value.createdAt, width: value.width, height: value.height,
      video: value.videoAsset
        ? this.sajikanVideo({
            ...value.videoAsset,
            status: (value.videoAsset.id && terkini?.get(value.videoAsset.id)) || value.videoAsset.status,
          })
        : null,
    };
  }

  /**
   * URL playback hanya diterbitkan untuk video yang benar-benar siap.
   *
   * Menyerahkan tautan pada video yang masih diproses membuat pemutar dibuka
   * pada berkas yang belum ada di CDN, dan yang dilihat pembaca adalah galat —
   * bukan keterangan bahwa videonya sedang disiapkan.
   */
  private sajikanVideo(aset: { status: string; providerVideoId: string }) {
    const siap = aset.status === 'AVAILABLE';
    const berlaku = new Date(Date.now() + this.video.playbackTtlSeconds * 1000);
    return {
      status: aset.status,
      playbackUrl: siap
        ? bunnySignedUrl(this.video.bunny, aset.providerVideoId, 'playlist.m3u8', berlaku)
        : null,
    };
  }
}
