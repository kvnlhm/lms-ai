import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoProvider, VideoStatus } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { bunnyPlaylistUrl } from '../application/video.service';

/** Cukup lama untuk satu permintaan, cukup singkat untuk tidak menyisakan URL berlaku. */
const MASA_BERLAKU_UJI_DETIK = 60;
const BATAS_WAKTU_MS = 8_000;

/**
 * Membuktikan sekali saat proses hidup bahwa URL pemutaran Bunny benar-benar
 * dilayani CDN.
 *
 * Kebenaran URL pemutaran bergantung pada dua setelan di dua tempat berbeda
 * yang tidak dapat saling melihat: `BUNNY_STREAM_TOKEN_AUTH_KEY` di sisi kita,
 * dan "CDN token authentication" di dashboard Bunny. Keduanya harus menyala
 * bersama atau padam bersama.
 *
 * Bila hanya kunci kita yang terisi, CDN membaca `bcdn_token=…` sebagai nama
 * folder sungguhan dan menjawab 404. Bila hanya setelan Bunny yang menyala,
 * URL kita dikirim tanpa tanda tangan dan dijawab 403. Kedua-duanya membuat
 * seluruh video Bunny mati, dan kedua-duanya tidak meninggalkan jejak apa pun
 * di sisi server — yang terlihat hanya pelajar yang videonya tidak mau jalan.
 *
 * Karena itu pemeriksaannya harus benar-benar meminta berkasnya, bukan sekadar
 * membaca konfigurasi. `Referer` diisi alamat web kita supaya permintaannya
 * menyerupai permintaan peramban pelajar; tanpa itu, pembatasan referrer di
 * sisi Bunny akan menolaknya dan hasilnya salah dibaca sebagai kesalahan token.
 *
 * Tidak pernah menggagalkan proses. CDN yang sedang terganggu bukan alasan
 * untuk menolak melayani seluruh aplikasi, dan pemutaran self-hosted tidak ada
 * hubungannya dengan ini.
 */
@Injectable()
export class BunnyPlaybackCheck implements OnModuleInit {
  private readonly logger = new Logger(BunnyPlaybackCheck.name);
  private readonly bunny: AppConfig['video']['bunny'];
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    const app = config.get('app', { infer: true });
    this.bunny = app.video.bunny;
    this.webUrl = app.webUrl;
  }

  onModuleInit(): void {
    if (!this.bunny.startupCheckEnabled || !this.bunny.cdnHostname) return;
    // Sengaja tidak ditunggu: kesehatan CDN pihak ketiga tidak boleh menahan
    // proses kita menerima permintaan.
    void this.jalankan().catch((error) => {
      this.logger.warn(`Pemeriksaan pemutaran Bunny gagal dijalankan: ${String(error)}`);
    });
  }

  /** Publik agar test dapat memanggilnya langsung tanpa menghidupkan modul. */
  async jalankan(): Promise<'OK' | 'LEWAT' | 'TIDAK_COCOK' | 'GAGAL'> {
    const aset = await this.prisma.videoAsset.findFirst({
      where: {
        provider: VideoProvider.BUNNY_STREAM,
        status: VideoStatus.AVAILABLE,
        deletedAt: null,
      },
      select: { providerVideoId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!aset) {
      this.logger.log('Belum ada video Bunny; pemeriksaan pemutaran dilewati.');
      return 'LEWAT';
    }

    const kedaluwarsa = new Date(Date.now() + MASA_BERLAKU_UJI_DETIK * 1_000);
    const url = bunnyPlaylistUrl(this.bunny, aset.providerVideoId, kedaluwarsa);
    if (!url) return 'LEWAT';

    const status = await this.status(url);
    if (status === 200) {
      this.logger.log(
        this.bunny.tokenAuthKey
          ? 'Pemutaran Bunny sehat; URL bertanda tangan diterima CDN.'
          : 'Pemutaran Bunny sehat; URL tanpa tanda tangan, perlindungan bersandar pada referrer.',
      );
      return 'OK';
    }

    // Kedua arah ketidaksepakatan meninggalkan jejak yang berbeda, dan hanya
    // satu di antaranya dapat dipastikan lewat permintaan pembanding.
    //
    // Bila kunci kita terisi sementara Bunny tidak memeriksanya, `bcdn_token=…`
    // menjadi nama folder yang tidak ada dan jawabannya 404. Itu dapat
    // dibuktikan: URL tanpa tanda tangan mestinya justru berhasil.
    //
    // Arah sebaliknya tidak dapat dibuktikan dengan cara yang sama, karena
    // tanda tangan yang sah mustahil disusun tanpa kuncinya. Yang tersisa
    // adalah menyimpulkan dari kode statusnya, dan mengakui bahwa 403 juga
    // dapat berarti alamat kita tidak ada di daftar referrer library.
    if (this.bunny.tokenAuthKey) {
      const polos = bunnyPlaylistUrl(
        { cdnHostname: this.bunny.cdnHostname },
        aset.providerVideoId,
        kedaluwarsa,
      );
      if (polos && (await this.status(polos)) === 200) {
        this.logger.error(
          'BUNNY_STREAM_TOKEN_AUTH_KEY terisi, tetapi "CDN token authentication" belum aktif di ' +
            'library Bunny. Setiap pemutaran akan dijawab 404. Nyalakan setelan itu di dashboard ' +
            'Bunny, atau kosongkan variabelnya.',
        );
        return 'TIDAK_COCOK';
      }
    } else if (status === 403) {
      this.logger.error(
        'URL tanpa tanda tangan ditolak CDN Bunny (403). Kemungkinan besar "CDN token ' +
          `authentication" aktif di library sementara BUNNY_STREAM_TOKEN_AUTH_KEY kosong; dapat ` +
          `juga berarti ${this.webUrl} belum masuk daftar referrer library.`,
      );
      return 'TIDAK_COCOK';
    }

    this.logger.error(
      `Pemutaran Bunny tidak dapat dibuktikan: CDN menjawab ${status ?? 'tidak ada jawaban'} ` +
        `untuk video ${aset.providerVideoId}. Periksa BUNNY_STREAM_CDN_HOSTNAME dan daftar referrer di library.`,
    );
    return 'GAGAL';
  }

  private async status(url: string): Promise<number | null> {
    try {
      const response = await fetch(url, {
        // Sebagian CDN melayani HEAD berbeda dari GET; yang diuji harus jalur
        // yang sama dengan yang ditempuh pemutar pelajar.
        method: 'GET',
        headers: { Referer: this.webUrl, Accept: '*/*' },
        signal: AbortSignal.timeout(BATAS_WAKTU_MS),
      });
      // Badannya tidak dipakai, tetapi harus dihabiskan agar koneksinya lepas.
      await response.arrayBuffer().catch(() => undefined);
      return response.status;
    } catch (error) {
      this.logger.warn(`Permintaan uji ke CDN Bunny gagal: ${String(error)}`);
      return null;
    }
  }
}
