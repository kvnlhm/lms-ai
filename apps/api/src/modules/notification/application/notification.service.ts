import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  /** Tautan relatif ke objek terkait; wajib menurut acceptance criteria PRD 7.14. */
  linkUrl?: string;
}

/**
 * Saklar preferensi mana yang mengatur tiap jenis notifikasi.
 *
 * Tabel `notification_preferences` hanya punya tiga saklar, jadi jenis
 * notifikasi dipetakan ke saklar yang paling masuk akal alih-alih menambah
 * kolom baru untuk setiap trigger.
 */
const PREFERENCE_OF: Record<
  NotificationType,
  'announcementsEnabled' | 'courseUpdatesEnabled' | 'learningRemindersEnabled'
> = {
  ENROLLED_IN_COURSE: 'courseUpdatesEnabled',
  COURSE_COMPLETED: 'courseUpdatesEnabled',
  LIVE_SESSION_SCHEDULED: 'learningRemindersEnabled',
  FORUM_REPLY: 'announcementsEnabled',
  FORUM_BEST_ANSWER: 'announcementsEnabled',
  FORUM_NEW_TOPIC: 'announcementsEnabled',
  FORUM_CONTENT_REPORTED: 'announcementsEnabled',
  // Pencabutan hak selalu dikirim: pelajar harus tahu mengapa ia ditolak
  // saat menulis, dan mematikannya akan membuat sistem terasa rusak.
  FORUM_PARTICIPATION_REVOKED: 'announcementsEnabled',
  FORUM_PARTICIPATION_RESTORED: 'announcementsEnabled',
};

/** Jenis yang tidak boleh dibungkam preferensi apa pun. */
const ALWAYS_DELIVER = new Set<NotificationType>([
  NotificationType.FORUM_PARTICIPATION_REVOKED,
  NotificationType.FORUM_PARTICIPATION_RESTORED,
]);

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mengirim notifikasi ke sejumlah penerima sekaligus.
   *
   * Kegagalan di sini tidak boleh menjatuhkan tindakan yang memicunya:
   * membalas diskusi harus tetap berhasil meski notifikasinya gagal ditulis.
   */
  async notify(userIds: string[], input: NotificationInput): Promise<number> {
    const recipients = [...new Set(userIds)].filter(Boolean);
    if (recipients.length === 0) return 0;

    try {
      const allowed = ALWAYS_DELIVER.has(input.type)
        ? recipients
        : await this.filterByPreference(recipients, input.type);
      if (allowed.length === 0) return 0;

      const created = await this.prisma.notification.createMany({
        data: allowed.map((userId) => ({
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl ?? null,
        })),
      });
      return created.count;
    } catch (error) {
      this.logger.error(
        `Notifikasi ${input.type} gagal ditulis: ${
          error instanceof Error ? error.message : 'penyebab tidak diketahui'
        }`,
      );
      return 0;
    }
  }

  /** Penerima yang tidak mematikan kategori notifikasi ini. */
  private async filterByPreference(
    userIds: string[],
    type: NotificationType,
  ): Promise<string[]> {
    const column = PREFERENCE_OF[type];
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, [column]: true } as never,
    });
    const disabled = new Set(
      (preferences as Array<Record<string, unknown>>)
        .filter((row) => row[column] === false)
        .map((row) => String(row.userId)),
    );
    // Pengguna tanpa baris preferensi memakai default aktif.
    return userIds.filter((userId) => !disabled.has(userId));
  }

  async list(userId: string, input: { unreadOnly: boolean; page: number; pageSize: number }) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(input.unreadOnly ? { readAt: null } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          linkUrl: true,
          readAt: true,
          createdAt: true,
        },
      }),
    ]);
    return { total, items };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, notificationId: string) {
    // Kepemilikan diperiksa lewat where, bukan setelah membaca barisnya,
    // sehingga notifikasi orang lain tidak dapat disimpulkan keberadaannya.
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await this.prisma.notification.count({ where: { id: notificationId, userId } });
      if (!exists) throw AppError.notFound();
    }
    return { id: notificationId, readAt: new Date() };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
