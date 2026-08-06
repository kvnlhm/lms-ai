import { Injectable } from '@nestjs/common';
import { CommunityChannelType } from '@prisma/client';
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

const JENIS = new Map([
  ['image/jpeg', { ext: 'jpg', cocok: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
  ['image/png', { ext: 'png', cocok: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/webp', { ext: 'webp', cocok: (b: Buffer) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }],
  ['video/mp4', { ext: 'mp4', cocok: (b: Buffer) => b.toString('ascii', 4, 8) === 'ftyp' }],
  ['video/webm', { ext: 'webm', cocok: (b: Buffer) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) }],
  ['application/pdf', { ext: 'pdf', cocok: (b: Buffer) => b.toString('ascii', 0, 5) === '%PDF-' }],
] as const);
type MimeLampiran = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/webm' | 'application/pdf';

@Injectable()
export class CommunityAttachmentService {
  private readonly config: AppConfig['communityAttachment'];

  constructor(private readonly prisma: PrismaService, config: ConfigService<{ app: AppConfig }, true>, private readonly audit: AuditService) {
    this.config = config.get('app', { infer: true }).communityAttachment;
  }

  private async post(postId: string, userId: string, canModerate: boolean) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { type: CommunityChannelType.CHECKLIST, archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, authorId: true, attachment: { select: { objectKey: true } } },
    });
    if (!post) throw AppError.notFound();
    if (post.authorId !== userId && !canModerate) throw AppError.permissionDenied();
    return post;
  }

  async upload(postId: string, userId: string, canModerate: boolean, stream: Readable, mimeType: string | undefined, originalName: string, contentLength: number | undefined) {
    const post = await this.post(postId, userId, canModerate);
    const jenis = mimeType ? JENIS.get(mimeType as MimeLampiran) : undefined;
    if (!jenis) throw AppError.validation({ file: ['Gunakan JPG, PNG, WebP, MP4, WebM, atau PDF.'] });
    if (!contentLength || contentLength < 1 || contentLength > this.config.maxUploadBytes) {
      throw AppError.validation({ file: [`Ukuran berkas harus antara 1 byte dan ${this.config.maxUploadBytes} byte.`] });
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

    let attachment;
    try {
      attachment = await this.prisma.communityPostAttachment.upsert({
        where: { postId },
        create: { postId, objectKey, originalName: this.namaAman(originalName), mimeType: mimeType!, sizeBytes: BigInt(contentLength) },
        update: { objectKey, originalName: this.namaAman(originalName), mimeType: mimeType!, sizeBytes: BigInt(contentLength) },
      });
    } catch (error) {
      await rm(finalPath, { force: true });
      throw error;
    }
    if (post.attachment?.objectKey && post.attachment.objectKey !== objectKey) await rm(join(this.config.storagePath, post.attachment.objectKey), { force: true });
    await this.audit.record({ actorUserId: userId, action: 'community.checklist_attachment.update', targetType: 'CommunityPost', targetId: postId, after: { mimeType, sizeBytes: String(contentLength) } });
    return this.sajikan(attachment);
  }

  async remove(postId: string, userId: string, canModerate: boolean) {
    await this.post(postId, userId, canModerate);
    const attachment = await this.prisma.communityPostAttachment.findUnique({ where: { postId } });
    if (!attachment) return;
    await this.prisma.communityPostAttachment.delete({ where: { postId } });
    await rm(join(this.config.storagePath, attachment.objectKey), { force: true });
    await this.audit.record({ actorUserId: userId, action: 'community.checklist_attachment.delete', targetType: 'CommunityPost', targetId: postId, before: { mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes.toString() } });
  }

  async authorised(postId: string) {
    const attachment = await this.prisma.communityPostAttachment.findFirst({
      where: { postId, post: { deletedAt: null, channel: { type: CommunityChannelType.CHECKLIST, archivedAt: null, group: { archivedAt: null } } } },
    });
    if (!attachment) throw AppError.notFound();
    return attachment;
  }

  private namaAman(name: string) { return name.replace(/[^\w.\- ]/g, '_').slice(0, 255) || 'lampiran'; }
  private sajikan(value: { id: string; originalName: string; mimeType: string; sizeBytes: bigint; createdAt: Date }) {
    return { id: value.id, originalName: value.originalName, mimeType: value.mimeType, sizeBytes: value.sizeBytes.toString(), createdAt: value.createdAt };
  }
}
