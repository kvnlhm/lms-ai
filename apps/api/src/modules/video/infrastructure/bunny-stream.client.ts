import { createHash } from 'node:crypto';
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

export interface BunnyLibraryVideo extends BunnyVideoMetadata {
  guid: string;
  durationSeconds: number;
  /** Nama berkas gambar sampul di dalam direktori video; belum bertanda tangan. */
  thumbnailFileName: string | null;
  uploadedAt: string | null;
}

export interface BunnyLibraryPage {
  items: BunnyLibraryVideo[];
  total: number;
}

/**
 * Izin sekali pakai untuk mengunggah satu video langsung dari peramban.
 *
 * Tanda tangannya dibuat di sini karena hanya server yang memegang API key
 * Bunny. Yang diberikan ke peramban tidak dapat dipakai untuk apa pun selain
 * mengunggah ke satu video ini, dan hanya sampai `expires`.
 */
export interface BunnyUploadTicket {
  videoId: string;
  libraryId: string;
  signature: string;
  expires: number;
  endpoint: string;
}

/** Alamat TUS Bunny; sama untuk semua library. */
const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';
/** Cukup panjang untuk unggahan besar pada sambungan rumahan. */
const MASA_BERLAKU_TIKET_DETIK = 6 * 60 * 60;

/**
 * Perantara ke Bunny Stream.
 *
 * Berkas videonya sendiri tidak pernah melewati server ini. Yang dikerjakan di
 * sini hanya yang menuntut API key: membaca metadata, membaca daftar
 * perpustakaan, membuat wadah video baru, dan menandatangani izin unggah.
 * Berkasnya berjalan langsung dari peramban Master ke Bunny — justru itulah
 * gunanya memakai Bunny, dan melewatkannya lewat VPS akan membatalkan
 * separuh manfaatnya.
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

  /**
   * Satu halaman isi library Bunny.
   *
   * Pencarian dan paginasinya diserahkan ke Bunny, bukan dikerjakan setelah
   * seluruh isinya diunduh. Library ini sudah berisi puluhan video dan akan
   * terus bertambah; mengunduh semuanya untuk menyaring tiga di antaranya
   * adalah permintaan yang tumbuh tanpa batas.
   */
  async listVideos(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<BunnyLibraryPage> {
    const query = new URLSearchParams({
      page: String(params.page),
      itemsPerPage: String(params.pageSize),
      orderBy: 'date',
    });
    if (params.search) query.set('search', params.search);

    const payload = (await this.minta(`/videos?${query.toString()}`)) as {
      items?: unknown;
      totalItems?: unknown;
    };
    const rows = Array.isArray(payload.items) ? payload.items : [];

    return {
      total: typeof payload.totalItems === 'number' ? payload.totalItems : rows.length,
      items: rows.map((row) => this.bacaVideo(row as Record<string, unknown>)),
    };
  }

  /**
   * Wadah kosong yang siap diisi berkas.
   *
   * Bunny memisahkan "membuat video" dari "mengunggah berkasnya", dan
   * pemisahan itu justru yang memungkinkan berkasnya tidak lewat sini: yang
   * dibuat server hanyalah wadah beserta izin unggahnya.
   */
  async createVideo(title: string): Promise<string> {
    const payload = (await this.minta('/videos', {
      method: 'POST',
      body: JSON.stringify({ title }),
      headers: { 'Content-Type': 'application/json' },
    })) as { guid?: unknown };

    const guid = typeof payload.guid === 'string' ? payload.guid : null;
    if (!guid) {
      this.logger.error('Bunny membuat video tanpa mengembalikan GUID.');
      throw AppError.validation({ title: ['Bunny tidak mengembalikan identitas video baru.'] });
    }
    return guid;
  }

  /**
   * Izin unggah TUS untuk satu video, berlaku terbatas.
   *
   * Rumus tanda tangannya ditentukan Bunny: SHA256 atas
   * `libraryId + apiKey + expires + videoId`. API key ikut masuk ke dalam
   * hash tetapi tidak pernah keluar dari server — itulah yang membuat izin ini
   * aman diberikan ke peramban.
   */
  uploadTicket(videoId: string): BunnyUploadTicket {
    const { libraryId, apiKey } = this.wajibTerkonfigurasi();
    const expires = Math.floor(Date.now() / 1000) + MASA_BERLAKU_TIKET_DETIK;
    const signature = createHash('sha256')
      .update(`${libraryId}${apiKey}${expires}${videoId}`)
      .digest('hex');
    return { videoId, libraryId, signature, expires, endpoint: TUS_ENDPOINT };
  }

  private wajibTerkonfigurasi(): { libraryId: string; apiKey: string } {
    if (!this.config.libraryId || !this.config.apiKey) {
      throw AppError.validation({
        provider: ['Bunny Stream belum dikonfigurasi pada server ini.'],
      });
    }
    return { libraryId: this.config.libraryId, apiKey: this.config.apiKey };
  }

  /** Satu permintaan ke API library, dengan galat yang sudah diterjemahkan. */
  private async minta(path: string, init: RequestInit = {}): Promise<unknown> {
    const { libraryId, apiKey } = this.wajibTerkonfigurasi();

    let response: Response;
    try {
      response = await fetch(
        `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}${path}`,
        {
          ...init,
          headers: { ...init.headers, AccessKey: apiKey, Accept: 'application/json' },
        },
      );
    } catch (caught) {
      this.logger.warn(`Gagal menghubungi Bunny Stream: ${String(caught)}`);
      throw AppError.validation({
        source: ['Bunny Stream tidak dapat dihubungi. Coba lagi sebentar lagi.'],
      });
    }

    if (!response.ok) {
      this.logger.warn(`Bunny Stream membalas ${response.status} untuk ${path}.`);
      throw AppError.validation({
        source: ['Bunny Stream menolak permintaan. Periksa kembali API key dan library ID.'],
      });
    }
    return (await response.json().catch(() => ({}))) as unknown;
  }

  private bacaVideo(row: Record<string, unknown>): BunnyLibraryVideo {
    const status = typeof row.status === 'number' ? row.status : null;
    const ukuran = typeof row.storageSize === 'number' && row.storageSize > 0 ? row.storageSize : null;
    const judul = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : '';
    return {
      guid: typeof row.guid === 'string' ? row.guid : '',
      title: judul,
      sizeBytes: ukuran,
      durationSeconds: typeof row.length === 'number' ? row.length : 0,
      thumbnailFileName:
        typeof row.thumbnailFileName === 'string' && row.thumbnailFileName ? row.thumbnailFileName : null,
      uploadedAt: typeof row.dateUploaded === 'string' ? row.dateUploaded : null,
      ready: status === BUNNY_STATUS_FINISHED,
      failed: status === BUNNY_STATUS_ERROR || status === BUNNY_STATUS_UPLOAD_FAILED,
    };
  }
}
