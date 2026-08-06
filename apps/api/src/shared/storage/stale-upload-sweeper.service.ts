import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppConfig } from '../../config/configuration';
import { STALE_UPLOAD_RECONCILER, type StaleUploadReconcilerPort } from './stale-upload.port';

const AKHIRAN = '.uploading';

/**
 * Membuang unggahan yang berhenti di tengah jalan.
 *
 * Setiap pengunggah menulis ke `<nama>.uploading` lalu me-`rename`-nya begitu
 * berkasnya utuh, dan membersihkan berkas sementara itu pada blok `catch`-nya.
 * Susunan itu benar untuk kegagalan biasa, tetapi tidak dapat menolong ketika
 * prosesnya sendiri yang mati — kontainer diganti saat deploy, misalnya, di
 * tengah unggahan 800 MB. Blok `catch` tidak pernah berjalan, dan berkas
 * separuh jadi itu tinggal selamanya karena tidak ada lagi yang mengetahui
 * keberadaannya.
 *
 * Poller ini yang menutup celah tersebut, mengikuti pola `AnnouncementScheduler`
 * agar tidak perlu menambah dependensi penjadwal baru.
 *
 * Umur berkas dibaca dari mtime, bukan waktu pembuatan: unggahan yang sedang
 * berjalan terus menulis sehingga mtime-nya ikut maju, dan karena itu unggahan
 * sah yang berlangsung lama tidak akan pernah tersapu di tengah jalan.
 */
@Injectable()
export class StaleUploadSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaleUploadSweeper.name);
  private readonly app: AppConfig;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private running = false;

  constructor(
    config: ConfigService<{ app: AppConfig }, true>,
    @Inject(STALE_UPLOAD_RECONCILER)
    private readonly reconcilers: StaleUploadReconcilerPort[],
  ) {
    this.app = config.get('app', { infer: true });
  }

  onModuleInit(): void {
    if (!this.app.upload.sweeperEnabled) return;
    // Sapuan pertama langsung dijalankan: kasus yang paling mungkin meninggalkan
    // sampah adalah proses yang mati, dan proses yang baru hidup inilah
    // penggantinya.
    this.schedule(0);
    this.logger.log('Penyapu unggahan terbengkalai aktif.');
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
    // Timer ini tidak boleh menahan proses tetap hidup saat shutdown.
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (error) {
      this.logger.error(
        `Siklus penyapu gagal: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
      this.schedule(this.app.upload.sweeperIntervalSeconds * 1_000);
    }
  }

  /** Direktori tempat berkas `.uploading` mungkin tertinggal. */
  private direktori(): string[] {
    return [
      this.app.video.storagePath,
      this.app.avatar.storagePath,
      this.app.courseThumbnail.storagePath,
      this.app.lessonMaterial.storagePath,
      this.app.communityAttachment.storagePath,
    ];
  }

  /**
   * Menjalankan satu sapuan.
   *
   * Publik agar test dapat memicunya langsung tanpa menunggu poller.
   */
  async runOnce(): Promise<{ berkas: number; baris: number }> {
    const batas = new Date(Date.now() - this.app.upload.staleAfterSeconds * 1_000);

    // Baris dirapikan lebih dulu. Bila urutannya dibalik dan proses mati di
    // antara keduanya, yang tersisa adalah baris berstatus berjalan tanpa berkas
    // sama sekali — keadaan yang tidak dapat dibedakan dari unggahan yang baru
    // saja dimulai, sehingga sapuan berikutnya pun ragu menyentuhnya.
    let baris = 0;
    for (const reconciler of this.reconcilers) {
      baris += await reconciler.closeStaleUploads(batas);
    }

    let berkas = 0;
    for (const direktori of this.direktori()) {
      berkas += await this.sapuDirektori(direktori, batas);
    }

    if (berkas > 0 || baris > 0) {
      this.logger.warn(
        `Unggahan terbengkalai dibersihkan: ${berkas} berkas, ${baris} catatan.`,
      );
    }
    return { berkas, baris };
  }

  private async sapuDirektori(direktori: string, batas: Date): Promise<number> {
    let isi: string[];
    try {
      isi = await readdir(direktori);
    } catch {
      // Direktori penyimpanan baru dibuat saat unggahan pertama. Belum adanya
      // direktori berarti belum ada apa pun untuk disapu.
      return 0;
    }

    let dibuang = 0;
    for (const nama of isi) {
      if (!nama.endsWith(AKHIRAN)) continue;
      const jalur = join(direktori, nama);
      try {
        const info = await stat(jalur);
        if (info.mtime > batas) continue;
        await rm(jalur, { force: true });
        dibuang += 1;
        this.logger.log(`Berkas unggahan terbengkalai dibuang: ${jalur}`);
      } catch (error) {
        // Satu berkas yang gagal dibuang tidak boleh menghentikan sisanya; yang
        // tertinggal akan dicoba lagi pada siklus berikutnya.
        this.logger.error(
          `Gagal membuang ${jalur}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return dibuang;
  }
}
