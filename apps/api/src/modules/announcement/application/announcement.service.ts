import { Injectable } from '@nestjs/common';
import { AnnouncementAudience, AnnouncementStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { NotificationService } from '../../notification/application/notification.service';

interface UpsertInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  courseId?: string;
  userIds?: string[];
  publishedAt?: Date;
  endsAt?: Date;
}

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Syarat sebuah pengumuman boleh dilihat pelajar.
   *
   * Tiga acceptance criteria PRD 7.13 bertemu di sini: draft tidak terlihat,
   * yang berakhir tidak tampil aktif, dan penjadwalan dihormati karena
   * `publishedAt` boleh berada di masa depan.
   */
  private visibleTo(userId: string, now: Date): Prisma.AnnouncementWhereInput {
    return {
      status: AnnouncementStatus.PUBLISHED,
      publishedAt: { not: null, lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      AND: [
        {
          OR: [
            { audience: AnnouncementAudience.ALL_USERS },
            {
              audience: AnnouncementAudience.COURSE_LEARNERS,
              course: { enrollments: { some: { userId, status: 'ACTIVE' } } },
            },
            {
              audience: AnnouncementAudience.SPECIFIC_USERS,
              targets: { some: { userId } },
            },
          ],
        },
      ],
    };
  }

  async forLearner(userId: string, page: number, pageSize: number) {
    const now = new Date();
    const where = this.visibleTo(userId, now);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          body: true,
          publishedAt: true,
          endsAt: true,
          course: { select: { id: true, title: true } },
          readState: { where: { userId }, select: { readAt: true } },
        },
      }),
    ]);

    return {
      total,
      items: rows.map(({ readState, ...row }) => ({
        ...row,
        readAt: readState[0]?.readAt ?? null,
      })),
    };
  }

  async unreadCount(userId: string): Promise<number> {
    const now = new Date();
    return this.prisma.announcement.count({
      where: { ...this.visibleTo(userId, now), readState: { none: { userId } } },
    });
  }

  async markRead(userId: string, announcementId: string) {
    // Kelayakan diperiksa ulang: pelajar tidak boleh menandai pengumuman yang
    // memang tidak ditujukan kepadanya, karena itu membocorkan keberadaannya.
    const visible = await this.prisma.announcement.count({
      where: { id: announcementId, ...this.visibleTo(userId, new Date()) },
    });
    if (!visible) throw AppError.notFound();

    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: {},
    });
    return { announcementId, readAt: new Date() };
  }

  // ─────────────────────────────────────────────
  // Master
  // ─────────────────────────────────────────────

  async list(status: AnnouncementStatus | undefined, page: number, pageSize: number) {
    const where: Prisma.AnnouncementWhereInput = status ? { status } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          body: true,
          audience: true,
          status: true,
          publishedAt: true,
          endsAt: true,
          createdAt: true,
          course: { select: { id: true, title: true } },
          creator: { select: { id: true, fullName: true } },
          _count: { select: { targets: true, readState: true } },
        },
      }),
    ]);
    return { total, items };
  }

  async create(input: UpsertInput, createdBy: string) {
    await this.assertAudience(input);

    return this.prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        audience: input.audience,
        courseId: input.audience === AnnouncementAudience.COURSE_LEARNERS ? input.courseId : null,
        publishedAt: input.publishedAt ?? null,
        endsAt: input.endsAt ?? null,
        createdBy,
        ...(input.audience === AnnouncementAudience.SPECIFIC_USERS && input.userIds
          ? { targets: { create: input.userIds.map((userId) => ({ userId })) } }
          : {}),
      },
      select: { id: true, title: true, status: true, publishedAt: true },
    });
  }

  async update(id: string, input: Partial<UpsertInput>) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
      select: { id: true, status: true, audience: true, courseId: true },
    });
    if (!existing) throw AppError.notFound();

    const audience = input.audience ?? existing.audience;
    if (input.audience || input.courseId || input.userIds) {
      await this.assertAudience({
        audience,
        courseId: input.courseId ?? existing.courseId ?? undefined,
        userIds: input.userIds,
      });
    }

    return this.prisma.announcement.update({
      where: { id },
      data: {
        title: input.title,
        body: input.body,
        audience: input.audience,
        courseId:
          audience === AnnouncementAudience.COURSE_LEARNERS
            ? (input.courseId ?? existing.courseId)
            : null,
        publishedAt: input.publishedAt,
        endsAt: input.endsAt,
        ...(input.userIds
          ? { targets: { deleteMany: {}, create: input.userIds.map((userId) => ({ userId })) } }
          : {}),
      },
      select: { id: true, title: true, status: true, publishedAt: true },
    });
  }

  /**
   * Menerbitkan pengumuman dan memberi tahu penerimanya.
   *
   * Notifikasi hanya dikirim bila pengumumannya benar-benar sudah tampil.
   * Yang dijadwalkan ke masa depan diberitahukan oleh `AnnouncementScheduler`
   * saat waktunya tiba, bukan dikirim lebih awal — memberi tahu tentang
   * sesuatu yang belum dapat dibuka hanya membuat pelajar menemukan halaman
   * kosong.
   */
  async publish(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      select: { id: true, status: true, title: true, audience: true, courseId: true, publishedAt: true },
    });
    if (!announcement) throw AppError.notFound();
    if (announcement.status === AnnouncementStatus.PUBLISHED) {
      throw AppError.validation({ status: ['Pengumuman ini sudah terbit.'] });
    }

    const now = new Date();
    const publishedAt = announcement.publishedAt ?? now;
    const immediate = publishedAt <= now;

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        status: AnnouncementStatus.PUBLISHED,
        publishedAt,
        // Ditandai di sini supaya penjadwal tidak mengirim ulang notifikasi
        // yang sudah dikirim pada langkah ini.
        ...(immediate ? { notifiedAt: now } : {}),
      },
      select: { id: true, title: true, status: true, publishedAt: true },
    });

    if (immediate) await this.notifyRecipients(announcement);
    return updated;
  }

  /**
   * Mengirim notifikasi "Pengumuman baru" kepada penerimanya.
   *
   * Dipakai bersama oleh penerbitan langsung dan penjadwal, sehingga aturan
   * siapa yang menerima hanya ada di satu tempat.
   */
  async notifyRecipients(announcement: {
    id: string;
    title: string;
    audience: AnnouncementAudience;
    courseId: string | null;
  }): Promise<void> {
    await this.notifications.notify(await this.recipientsOf(announcement), {
      type: 'ANNOUNCEMENT_PUBLISHED',
      title: 'Pengumuman baru',
      body: announcement.title,
      linkUrl: '/announcements',
    });
  }

  async archive(id: string) {
    const existing = await this.prisma.announcement.count({ where: { id } });
    if (!existing) throw AppError.notFound();
    return this.prisma.announcement.update({
      where: { id },
      data: { status: AnnouncementStatus.ARCHIVED },
      select: { id: true, status: true },
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.announcement.count({ where: { id } });
    if (!existing) throw AppError.notFound();
    await this.prisma.announcement.delete({ where: { id } });
  }

  /** Siapa yang harus menerima pengumuman ini. */
  private async recipientsOf(announcement: {
    id: string;
    audience: AnnouncementAudience;
    courseId: string | null;
  }): Promise<string[]> {
    if (announcement.audience === AnnouncementAudience.ALL_USERS) {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      });
      return users.map(({ id }) => id);
    }
    if (announcement.audience === AnnouncementAudience.COURSE_LEARNERS) {
      const learners = await this.prisma.enrollment.findMany({
        where: { courseId: announcement.courseId ?? '', status: 'ACTIVE' },
        select: { userId: true },
      });
      return learners.map(({ userId }) => userId);
    }
    const targets = await this.prisma.announcementTarget.findMany({
      where: { announcementId: announcement.id },
      select: { userId: true },
    });
    return targets.map(({ userId }) => userId);
  }

  private async assertAudience(input: {
    audience: AnnouncementAudience;
    courseId?: string;
    userIds?: string[];
  }): Promise<void> {
    if (input.audience === AnnouncementAudience.COURSE_LEARNERS) {
      if (!input.courseId) {
        throw AppError.validation({ courseId: ['Pilih kursus untuk audiens ini.'] });
      }
      const course = await this.prisma.course.count({ where: { id: input.courseId } });
      if (!course) throw AppError.validation({ courseId: ['Kursus tidak ditemukan.'] });
    }
    if (input.audience === AnnouncementAudience.SPECIFIC_USERS) {
      if (!input.userIds || input.userIds.length === 0) {
        throw AppError.validation({ userIds: ['Pilih minimal satu penerima.'] });
      }
      const found = await this.prisma.user.count({
        where: { id: { in: input.userIds }, deletedAt: null },
      });
      if (found !== input.userIds.length) {
        throw AppError.validation({ userIds: ['Sebagian penerima tidak ditemukan.'] });
      }
    }
  }
}
