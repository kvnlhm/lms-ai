import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaybackStatus, Prisma, VideoProvider, VideoStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';

interface UploadIntent {
  lessonId: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class VideoService {
  private readonly config: AppConfig['video'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.config = config.get('app', { infer: true }).video;
  }

  async createUploadIntent(input: UploadIntent, userId: string) {
    if (this.config.provider !== 'SELF_HOSTED') {
      throw AppError.validation({ provider: ['Provider video yang dikonfigurasi belum didukung.'] });
    }
    if (input.mimeType !== 'video/mp4' || !input.fileName.toLowerCase().endsWith('.mp4')) {
      throw AppError.validation({ file: ['Hanya file MP4 yang didukung.'] });
    }
    if (input.sizeBytes < 1 || input.sizeBytes > this.config.maxUploadBytes) {
      throw AppError.validation({
        sizeBytes: [`Ukuran video harus antara 1 dan ${this.config.maxUploadBytes} byte.`],
      });
    }
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: input.lessonId },
      select: { id: true, contentType: true },
    });
    if (!lesson) throw AppError.notFound();
    if (lesson.contentType !== 'VIDEO') {
      throw AppError.validation({ lessonId: ['Lesson bukan bertipe VIDEO.'] });
    }

    const providerVideoId = randomUUID();
    try {
      const asset = await this.prisma.videoAsset.create({
        data: {
          lessonId: input.lessonId,
          createdBy: userId,
          provider: VideoProvider.SELF_HOSTED,
          providerVideoId,
          originalName: input.fileName.replace(/[^\w.\- ]/g, '_').slice(0, 255),
          title: input.title,
          mimeType: input.mimeType,
          sizeBytes: BigInt(input.sizeBytes),
        },
      });
      return {
        videoAssetId: asset.id,
        provider: asset.provider,
        providerVideoId,
        uploadUrl: `/api/v1/admin/videos/${asset.id}/content`,
        method: 'PUT',
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(input.sizeBytes) },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.validation({ lessonId: ['Lesson sudah memiliki video aktif.'] });
      }
      throw error;
    }
  }

  async upload(assetId: string, userId: string, stream: Readable, contentLength: number | undefined) {
    const asset = await this.prisma.videoAsset.findFirst({
      where: { id: assetId, createdBy: userId, deletedAt: null, status: VideoStatus.CREATED },
    });
    if (!asset) throw AppError.notFound();
    if (!contentLength || contentLength !== Number(asset.sizeBytes)) {
      throw AppError.validation({ contentLength: ['Content-Length harus sama dengan upload intent.'] });
    }
    if (contentLength > this.config.maxUploadBytes) {
      throw AppError.validation({ contentLength: ['Ukuran video melewati batas.'] });
    }

    const objectKey = `${asset.id}.mp4`;
    const tempPath = join(this.config.storagePath, `${objectKey}.uploading`);
    const finalPath = join(this.config.storagePath, objectKey);
    await mkdir(this.config.storagePath, { recursive: true, mode: 0o750 });
    await this.prisma.videoAsset.update({
      where: { id: asset.id },
      data: { status: VideoStatus.UPLOADING },
    });

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
      await pipeline(stream, validator, createWriteStream(tempPath, { flags: 'wx', mode: 0o640 }));
      if (bytes !== contentLength || header.length < 12 || header.toString('ascii', 4, 8) !== 'ftyp') {
        throw new Error('Konten bukan MP4 yang valid atau ukurannya tidak lengkap.');
      }
      await rename(tempPath, finalPath);
      const available = await this.prisma.videoAsset.update({
        where: { id: asset.id },
        data: { objectKey, status: VideoStatus.AVAILABLE, processingError: null },
      });
      return {
        videoAssetId: available.id,
        provider: available.provider,
        status: available.status,
        sizeBytes: available.sizeBytes.toString(),
      };
    } catch (error) {
      await rm(tempPath, { force: true });
      await this.prisma.videoAsset.update({
        where: { id: asset.id },
        data: {
          status: VideoStatus.FAILED,
          processingError: error instanceof Error ? error.message.slice(0, 500) : 'Upload gagal.',
        },
      });
      throw AppError.validation({ file: ['Upload MP4 gagal atau konten tidak valid.'] });
    }
  }

  async createPlaybackSession(lessonId: string, userId: string, deviceId?: string) {
    const access = await this.access.assertLessonAccess(userId, lessonId);
    const asset = await this.prisma.videoAsset.findFirst({
      where: { lessonId, status: VideoStatus.AVAILABLE, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!asset) throw new AppError('FILE_NOT_AVAILABLE', 409, 'Video belum tersedia.');
    const expiresAt = new Date(Date.now() + this.config.playbackTtlSeconds * 1000);
    const playback = await this.prisma.videoPlaybackSession.create({
      data: {
        videoAssetId: asset.id,
        userId,
        enrollmentId: access.enrollmentId,
        deviceId,
        expiresAt,
      },
    });
    return {
      playbackSessionId: playback.id,
      provider: asset.provider,
      providerVideoId: asset.providerVideoId,
      playbackUrl: `/api/v1/playback-sessions/${playback.id}/content`,
      expiresAt: expiresAt.toISOString(),
      drm: { enabled: false, type: 'NONE' },
    };
  }

  async authorisedObject(playbackSessionId: string, userId: string): Promise<string> {
    const playback = await this.prisma.videoPlaybackSession.findFirst({
      where: {
        id: playbackSessionId,
        userId,
        status: PlaybackStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: { videoAsset: true },
    });
    if (!playback?.videoAsset.objectKey || playback.videoAsset.status !== VideoStatus.AVAILABLE) {
      throw AppError.notFound();
    }
    await this.access.assertLessonAccess(userId, playback.videoAsset.lessonId);
    return playback.videoAsset.objectKey;
  }
}
