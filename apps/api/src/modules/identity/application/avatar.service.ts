import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

const TYPES = {
  'image/jpeg': { extension: 'jpg', signature: (header: Buffer) => header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  'image/png': { extension: 'png', signature: (header: Buffer) => header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', signature: (header: Buffer) => header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP' },
} as const;

@Injectable()
export class AvatarService {
  private readonly config: AppConfig['avatar'];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.config = config.get('app', { infer: true }).avatar;
  }

  async upload(
    userId: string,
    stream: Readable,
    mimeType: string | undefined,
    contentLength: number | undefined,
  ): Promise<{ avatarUrl: string }> {
    const imageType = TYPES[mimeType as keyof typeof TYPES];
    if (!imageType) {
      throw AppError.validation({ file: ['Foto harus berupa JPEG, PNG, atau WebP.'] });
    }
    if (!contentLength || contentLength < 1 || contentLength > this.config.maxUploadBytes) {
      throw AppError.validation({
        file: [`Ukuran foto harus antara 1 byte dan ${this.config.maxUploadBytes} byte.`],
      });
    }

    await mkdir(this.config.storagePath, { recursive: true, mode: 0o755 });
    await chmod(this.config.storagePath, 0o755);
    const filename = `${userId}-${randomUUID()}.${imageType.extension}`;
    const temporaryPath = join(this.config.storagePath, `${filename}.uploading`);
    const finalPath = join(this.config.storagePath, filename);
    let bytes = 0;
    let header = Buffer.alloc(0);
    const validator = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > contentLength) return callback(new Error('Upload melebihi Content-Length.'));
        if (header.length < 12) header = Buffer.concat([header, chunk]).subarray(0, 12);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(stream, validator, createWriteStream(temporaryPath, { flags: 'wx', mode: 0o644 }));
      if (bytes !== contentLength || !imageType.signature(header)) {
        throw new Error('Signature file tidak sesuai tipe gambar.');
      }
      await rename(temporaryPath, finalPath);
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });
      if (!user) throw AppError.notFound();
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: `/api/v1/auth/avatars/${filename}` },
      });
      await this.removePrevious(user.avatarUrl, filename).catch(() => undefined);
      return { avatarUrl: `/api/v1/auth/avatars/${filename}` };
    } catch (error) {
      await rm(temporaryPath, { force: true });
      await rm(finalPath, { force: true });
      if (error instanceof AppError) throw error;
      throw AppError.validation({ file: ['Upload foto gagal atau isi file tidak valid.'] });
    }
  }

  async remove(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!user) throw AppError.notFound();
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await this.removePrevious(user.avatarUrl);
  }

  async open(filename: string): Promise<{ stream: Readable; size: number; mimeType: string }> {
    if (!/^[0-9a-f-]{36}-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) {
      throw AppError.notFound();
    }
    const path = join(this.config.storagePath, filename);
    try {
      const info = await stat(path);
      const extension = filename.split('.').pop();
      return {
        stream: createReadStream(path),
        size: info.size,
        mimeType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
      };
    } catch {
      throw AppError.notFound();
    }
  }

  private async removePrevious(previousUrl: string | null, keepFilename?: string): Promise<void> {
    if (!previousUrl) return;
    const filename = basename(previousUrl);
    if (filename === keepFilename || !/^[0-9a-f-]{36}-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) return;
    await rm(join(this.config.storagePath, filename), { force: true });
  }
}
