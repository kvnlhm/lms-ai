import { Injectable, Logger } from '@nestjs/common';
import type { EventJob } from './event-job';
import { readString } from './event-job';

/**
 * Pemberitahuan atas capaian belajar.
 *
 * Pengiriman email dan notifikasi dalam aplikasi belum diimplementasikan;
 * modul communication yang akan memilikinya. Untuk sekarang handler mencatat
 * niat pengiriman sehingga jalur outbox dapat diamati dari ujung ke ujung
 * tanpa berpura-pura sudah mengirim apa pun.
 */
@Injectable()
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  handle(job: EventJob): { queued: boolean } {
    if (job.eventType !== 'learning.course_completed') {
      return { queued: false };
    }

    const userId = readString(job.payload ?? {}, 'userId');
    this.logger.log(
      `Kursus selesai untuk pengguna ${userId ?? 'tidak diketahui'}; ` +
        'notifikasi akan dikirim setelah modul communication tersedia.',
    );
    return { queued: true };
  }
}
