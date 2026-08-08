import { Injectable, Logger } from '@nestjs/common';
import { VideoProvider, VideoStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { BunnyStreamClient } from '../infrastructure/bunny-stream.client';
import type { AsetVideoBaru, VideoProvisionerPort } from './video-provisioning.port';

/** Status yang tidak akan berubah lagi; menanyakannya ke penyedia sia-sia. */
const TERMINAL = new Set<VideoStatus>([VideoStatus.AVAILABLE, VideoStatus.FAILED, VideoStatus.DELETED]);

/**
 * Menyiapkan dan menyelaraskan aset video bagi modul di luar Video.
 *
 * Seluruh pengetahuan tentang Bunny berhenti di kelas ini. Pemanggilnya —
 * saat ini komunitas — hanya melihat `VideoProvisionerPort` yang tidak menyebut
 * penyedia mana pun.
 */
@Injectable()
export class VideoProvisionerService implements VideoProvisionerPort {
  private readonly logger = new Logger(VideoProvisionerService.name);

  constructor(private readonly prisma: PrismaService, private readonly bunny: BunnyStreamClient) {}

  async siapkanUnggahan(input: { ownerId: string; title: string; originalName: string }): Promise<AsetVideoBaru> {
    // Video dibuat di penyedia lebih dulu. Terbalik, dan penyedia yang menolak
    // meninggalkan baris aset yang tidak pernah punya video di mana pun.
    const providerVideoId = await this.bunny.createVideo(input.title);

    const aset = await this.prisma.videoAsset.create({
      data: {
        createdBy: input.ownerId,
        provider: VideoProvider.BUNNY_STREAM,
        providerVideoId,
        title: input.title,
        originalName: input.originalName,
        status: VideoStatus.CREATED,
      },
      select: { id: true },
    });

    return { videoAssetId: aset.id, tiket: this.bunny.uploadTicket(providerVideoId) };
  }

  async selaraskan(videoAssetId: string): Promise<string> {
    const aset = await this.prisma.videoAsset.findFirst({
      where: { id: videoAssetId, deletedAt: null },
      select: { id: true, provider: true, providerVideoId: true, status: true },
    });
    if (!aset) throw AppError.notFound();
    if (aset.provider !== VideoProvider.BUNNY_STREAM || TERMINAL.has(aset.status)) return aset.status;

    let metadata;
    try {
      metadata = await this.bunny.fetchVideo(aset.providerVideoId);
    } catch (error) {
      // Penyedia yang sedang tidak dapat dihubungi bukan alasan menjatuhkan
      // halaman yang sedang dibaca orang.
      this.logger.warn(`Gagal menyelaraskan aset ${aset.id}: ${error instanceof Error ? error.message : error}`);
      return aset.status;
    }
    if (!metadata.ready && !metadata.failed) return VideoStatus.PROCESSING;

    const status = metadata.ready ? VideoStatus.AVAILABLE : VideoStatus.FAILED;
    await this.prisma.videoAsset.update({
      where: { id: aset.id },
      data: {
        status,
        sizeBytes: metadata.sizeBytes === null ? undefined : BigInt(metadata.sizeBytes),
        processingError: metadata.failed ? 'Penyedia gagal memproses video ini.' : null,
      },
    });
    return status;
  }
}
