import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnnouncementStatus } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AnnouncementService } from './announcement.service';

/**
 * Memberitahukan pengumuman yang waktunya sudah tiba.
 *
 * Penjadwalan tampilnya sendiri sudah bekerja tanpa pekerjaan latar: sebuah
 * pengumuman berstatus `PUBLISHED` dengan `publishedAt` di masa depan memang
 * tidak lolos saringan `visibleTo` sampai waktunya. Yang tidak bekerja adalah
 * notifikasinya — `publish()` hanya memberi tahu bila pengumumannya langsung
 * tampil, sehingga yang dijadwalkan muncul diam-diam tanpa ada yang tahu.
 *
 * Dibuat sebagai poller sederhana, mengikuti pola `OutboxRelayService`, supaya
 * tidak perlu menambah dependensi penjadwal baru untuk satu pekerjaan.
 */
@Injectable()
export class AnnouncementScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnnouncementScheduler.name);
  private readonly app: AppConfig;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly announcements: AnnouncementService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  onModuleInit(): void {
    if (!this.app.announcement.schedulerEnabled) return;
    this.schedule(0);
    this.logger.log('Penjadwal pengumuman aktif.');
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
        `Siklus penjadwal gagal: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
      this.schedule(this.app.announcement.schedulerIntervalSeconds * 1_000);
    }
  }

  /**
   * Menjalankan satu siklus. Mengembalikan jumlah pengumuman yang diberitahukan.
   *
   * Publik agar test dapat memicunya secara langsung tanpa menunggu poller.
   */
  async runOnce(): Promise<number> {
    const now = new Date();

    const due = await this.prisma.announcement.findMany({
      where: {
        status: AnnouncementStatus.PUBLISHED,
        notifiedAt: null,
        publishedAt: { not: null, lte: now },
        // Yang sudah berakhir sebelum sempat diberitahukan tidak perlu
        // diumumkan lagi; pelajar hanya akan menemukan halaman kosong.
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { id: true, title: true, audience: true, courseId: true },
    });

    let notified = 0;
    for (const announcement of due) {
      // Klaim lebih dulu, baru kirim. Urutan ini kebalikan dari relay outbox,
      // dan sengaja: di sana pengiriman ganda murah, sedangkan di sini ia
      // berarti ratusan pelajar menerima notifikasi yang sama dua kali. Bila
      // pengiriman gagal setelah klaim, pengumumannya tetap tampil di halaman
      // — jadi yang hilang hanya dorongannya, bukan isinya.
      const claimed = await this.prisma.announcement.updateMany({
        where: { id: announcement.id, notifiedAt: null },
        data: { notifiedAt: now },
      });
      if (claimed.count === 0) continue;

      try {
        await this.announcements.notifyRecipients(announcement);
        notified += 1;
      } catch (error) {
        this.logger.error(
          `Notifikasi pengumuman ${announcement.id} gagal: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (notified > 0) {
      this.logger.log(`${notified} pengumuman terjadwal diberitahukan.`);
    }
    return notified;
  }
}
