import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import { AppError } from '../../../shared/errors/app-error';

/** Kode status Bunny Stream; hanya `4` yang berarti video siap diputar. */
const BUNNY_STATUS_FINISHED = 4;
const BUNNY_STATUS_ERROR = 5;
const BUNNY_STATUS_UPLOAD_FAILED = 6;

export interface BunnyVideoMetadata {
  title: string;
  sizeBytes: number | null;
  /** Sudah selesai ditranskode dan aman ditautkan ke pelajaran. */
  ready: boolean;
  failed: boolean;
}

/**
 * Pembacaan metadata video dari Bunny Stream.
 *
 * Hanya membaca, tidak pernah mengunggah: berkasnya diunggah Master lewat
 * dashboard Bunny, dan yang kita daftarkan adalah GUID-nya. Pemanggilan ini
 * ada supaya GUID yang salah ketik ditolak saat itu juga, alih-alih menjadi
 * pelajaran yang videonya gagal diputar berminggu-minggu kemudian.
 */
@Injectable()
export class BunnyStreamClient {
  private readonly logger = new Logger(BunnyStreamClient.name);
  private readonly config: AppConfig['video']['bunny'];

  constructor(config: ConfigService<{ app: AppConfig }, true>) {
    this.config = config.get('app', { infer: true }).video.bunny;
  }

  /** Terisi cukup untuk memanggil API Bunny; hostname CDN dipakai saat memutar. */
  configured(): boolean {
    return Boolean(this.config.libraryId && this.config.apiKey);
  }

  async fetchVideo(videoId: string): Promise<BunnyVideoMetadata> {
    if (!this.config.libraryId || !this.config.apiKey) {
      throw AppError.validation({
        provider: ['Bunny Stream belum dikonfigurasi pada server ini.'],
      });
    }

    let response: Response;
    try {
      response = await fetch(
        `https://video.bunnycdn.com/library/${encodeURIComponent(this.config.libraryId)}/videos/${encodeURIComponent(videoId)}`,
        { headers: { AccessKey: this.config.apiKey, Accept: 'application/json' } },
      );
    } catch (caught) {
      // Jaringan gagal bukan berarti videonya tidak ada; katakan apa adanya
      // supaya Master tidak menghapus video yang sebenarnya baik-baik saja.
      this.logger.warn(`Gagal menghubungi Bunny Stream: ${String(caught)}`);
      throw AppError.validation({
        source: ['Bunny Stream tidak dapat dihubungi. Coba lagi sebentar lagi.'],
      });
    }

    if (response.status === 404) {
      throw AppError.validation({
        source: ['Video dengan GUID itu tidak ada di library Bunny yang dikonfigurasi.'],
      });
    }
    if (!response.ok) {
      this.logger.warn(`Bunny Stream membalas ${response.status} untuk video ${videoId}.`);
      throw AppError.validation({
        source: ['Bunny Stream menolak permintaan. Periksa kembali API key dan library ID.'],
      });
    }

    const payload = (await response.json().catch(() => ({}))) as {
      title?: unknown; status?: unknown; storageSize?: unknown;
    };
    const status = typeof payload.status === 'number' ? payload.status : null;
    const ukuran = typeof payload.storageSize === 'number' && payload.storageSize > 0
      ? payload.storageSize
      : null;

    return {
      title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : '',
      sizeBytes: ukuran,
      ready: status === BUNNY_STATUS_FINISHED,
      failed: status === BUNNY_STATUS_ERROR || status === BUNNY_STATUS_UPLOAD_FAILED,
    };
  }
}
