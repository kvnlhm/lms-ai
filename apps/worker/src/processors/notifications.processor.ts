import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma.service';
import { readString, type EventJob } from './event-job';

/**
 * Pemberitahuan atas capaian belajar.
 *
 * Channel-nya hanya in-app, sesuai PRD 7.14. Email sengaja tidak dikirim dari
 * sini: `notifications` adalah tabel turunan yang boleh ditulis worker
 * (ADR-012), sedangkan surat keluar milik modul communication yang belum ada.
 *
 * Sebelumnya handler ini hanya mencatat log lalu membalas `queued: true`,
 * sehingga jalur outbox terlihat sehat sampai ke ujung padahal tidak ada
 * pelajar yang pernah menerima apa pun.
 */
@Injectable()
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(job: EventJob): Promise<{ queued: boolean }> {
    if (job.eventType !== 'learning.course_completed') {
      return { queued: false };
    }

    const payload = job.payload ?? {};
    const userId = readString(payload, 'userId');
    const courseId = readString(payload, 'courseId');
    if (!userId || !courseId) {
      // Job tidak dilempar ulang: payload yang cacat tidak akan membaik dengan
      // dicoba lagi, dan BullMQ akan mengulangnya tanpa henti.
      this.logger.warn(`Event ${job.eventId} tanpa userId atau courseId; dilewati.`);
      return { queued: false };
    }

    const linkUrl = `/courses/${courseId}`;

    // Relay outbox bersifat at-least-once dan BullMQ mencoba ulang job yang
    // gagal, jadi event yang sama dapat tiba dua kali. Tidak ada constraint
    // unik yang bisa dipakai di `notifications`, sehingga penyaringnya berupa
    // pemeriksaan keberadaan — cukup untuk percobaan ulang yang berurutan,
    // yang merupakan satu-satunya sumber duplikat di sini karena API hanya
    // menulis event ini pada transisi selesai yang sesungguhnya.
    const sudahAda = await this.prisma.notification.count({
      where: { userId, type: NotificationType.COURSE_COMPLETED, linkUrl },
    });
    if (sudahAda > 0) {
      this.logger.debug(`Notifikasi kursus selesai ${courseId} untuk ${userId} sudah ada.`);
      return { queued: false };
    }

    // Pelajar yang mematikan kabar seputar kursus tidak diberi tahu, sama
    // seperti aturan di NotificationService milik API.
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: { courseUpdatesEnabled: true },
    });
    if (preference?.courseUpdatesEnabled === false) {
      return { queued: false };
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });
    if (!course) {
      this.logger.warn(`Kursus ${courseId} tidak ditemukan; notifikasi dilewati.`);
      return { queued: false };
    }

    await this.prisma.notification.create({
      data: {
        userId,
        type: NotificationType.COURSE_COMPLETED,
        title: 'Kursus selesai',
        body: `Selamat, kamu telah menyelesaikan ${course.title}.`,
        linkUrl,
      },
    });

    this.logger.log(`Notifikasi kursus selesai dikirim ke ${userId} untuk kursus ${courseId}.`);
    return { queued: true };
  }
}
