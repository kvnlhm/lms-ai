import { Injectable } from '@nestjs/common';
import { ForumReportStatus, ForumTopicStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { NotificationService } from '../../notification/application/notification.service';

const authorSelect = { id: true, fullName: true, email: true } as const;

interface BanInput {
  userId: string;
  courseId?: string;
  reason: string;
  expiresAt?: Date;
}

/**
 * Kewenangan Master atas forum (PRD 7.12 bagian Fitur Master).
 *
 * Berbeda dari `ForumService`, kelas ini sengaja tidak memeriksa enrollment:
 * Master memoderasi kursus yang tidak ia ikuti. Pembatasnya adalah permission
 * `discussions.moderate` di lapisan controller.
 */
@Injectable()
export class ForumModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async listTopics(input: {
    courseId?: string;
    status?: ForumTopicStatus;
    search?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.ForumTopicWhereInput = {
      deletedAt: null,
      ...(input.courseId ? { courseId: input.courseId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { body: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, topics] = await this.prisma.$transaction([
      this.prisma.forumTopic.count({ where }),
      this.prisma.forumTopic.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { lastActivityAt: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          isPinned: true,
          replyCount: true,
          lastActivityAt: true,
          createdAt: true,
          moderationReason: true,
          author: { select: authorSelect },
          course: { select: { id: true, title: true } },
          _count: { select: { reports: true } },
        },
      }),
    ]);
    return { total, topics };
  }

  async setTopicStatus(
    topicId: string,
    status: ForumTopicStatus,
    moderatorId: string,
    reason?: string,
  ) {
    await this.assertTopicExists(topicId);
    return this.prisma.forumTopic.update({
      where: { id: topicId },
      data: {
        status,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        moderationReason: reason ?? null,
      },
      select: { id: true, status: true, moderationReason: true, moderatedAt: true },
    });
  }

  async setPinned(topicId: string, isPinned: boolean) {
    await this.assertTopicExists(topicId);
    return this.prisma.forumTopic.update({
      where: { id: topicId },
      data: { isPinned },
      select: { id: true, isPinned: true },
    });
  }

  /** Menandai jawaban terbaik, atau membatalkannya dengan `replyId` null. */
  async setBestReply(topicId: string, replyId: string | null) {
    await this.assertTopicExists(topicId);
    if (replyId) {
      const belongs = await this.prisma.forumReply.count({
        where: { id: replyId, topicId, deletedAt: null, isHidden: false },
      });
      if (!belongs) {
        throw AppError.validation({ replyId: ['Balasan bukan bagian dari topik ini.'] });
      }
    }
    const updated = await this.prisma.forumTopic.update({
      where: { id: topicId },
      data: {
        bestReplyId: replyId,
        // Menandai jawaban terbaik berarti pertanyaannya sudah terjawab.
        status: replyId ? ForumTopicStatus.RESOLVED : undefined,
      },
      select: { id: true, bestReplyId: true, status: true, courseId: true, title: true },
    });

    if (replyId) {
      const reply = await this.prisma.forumReply.findUnique({
        where: { id: replyId },
        select: { authorId: true },
      });
      if (reply) {
        await this.notifications.notify([reply.authorId], {
          type: 'FORUM_BEST_ANSWER',
          title: 'Jawabanmu ditandai sebagai jawaban terbaik',
          body: updated.title,
          linkUrl: `/learn/${updated.courseId}/forum/${updated.id}`,
        });
      }
    }
    return { id: updated.id, bestReplyId: updated.bestReplyId, status: updated.status };
  }

  async setReplyHidden(replyId: string, isHidden: boolean, moderatorId: string, reason?: string) {
    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, deletedAt: null },
      select: { id: true },
    });
    if (!reply) throw AppError.notFound();
    return this.prisma.forumReply.update({
      where: { id: replyId },
      data: {
        isHidden,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        moderationReason: reason ?? null,
      },
      select: { id: true, isHidden: true, moderationReason: true },
    });
  }

  async deleteTopic(topicId: string): Promise<void> {
    await this.assertTopicExists(topicId);
    await this.prisma.forumTopic.update({
      where: { id: topicId },
      data: { deletedAt: new Date() },
    });
  }

  async deleteReply(replyId: string): Promise<void> {
    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, deletedAt: null },
      select: { id: true, topicId: true },
    });
    if (!reply) throw AppError.notFound();
    await this.prisma.$transaction([
      this.prisma.forumReply.update({ where: { id: replyId }, data: { deletedAt: new Date() } }),
      this.prisma.forumTopic.update({
        where: { id: reply.topicId },
        data: { replyCount: { decrement: 1 } },
      }),
    ]);
  }

  /** Master ikut menjawab. Tidak lewat jalur pelajar karena tanpa enrollment. */
  async reply(topicId: string, moderatorId: string, body: string) {
    const topic = await this.prisma.forumTopic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: { id: true },
    });
    if (!topic) throw AppError.notFound();
    const [reply] = await this.prisma.$transaction([
      this.prisma.forumReply.create({
        data: { topicId, authorId: moderatorId, body },
        select: { id: true, body: true, createdAt: true },
      }),
      this.prisma.forumTopic.update({
        where: { id: topicId },
        data: { replyCount: { increment: 1 }, lastActivityAt: new Date() },
      }),
    ]);
    return reply;
  }

  // ─────────────────────────────────────────────
  // Laporan konten
  // ─────────────────────────────────────────────

  async listReports(status: ForumReportStatus | undefined, page: number, pageSize: number) {
    const where: Prisma.ForumReportWhereInput = status ? { status } : {};
    const [total, reports] = await this.prisma.$transaction([
      this.prisma.forumReport.count({ where }),
      this.prisma.forumReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reason: true,
          status: true,
          createdAt: true,
          reporter: { select: authorSelect },
          topic: { select: { id: true, title: true, status: true } },
          reply: {
            select: {
              id: true,
              body: true,
              isHidden: true,
              topic: { select: { id: true, title: true } },
            },
          },
        },
      }),
    ]);
    return { total, reports };
  }

  async resolveReport(reportId: string, status: ForumReportStatus, reviewerId: string) {
    if (status === ForumReportStatus.PENDING) {
      throw AppError.validation({ status: ['Laporan hanya dapat ditutup, bukan dikembalikan.'] });
    }
    const report = await this.prisma.forumReport.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    if (!report) throw AppError.notFound();
    return this.prisma.forumReport.update({
      where: { id: reportId },
      data: { status, reviewedBy: reviewerId, reviewedAt: new Date() },
      select: { id: true, status: true, reviewedAt: true },
    });
  }

  // ─────────────────────────────────────────────
  // Pencabutan hak berpartisipasi
  // ─────────────────────────────────────────────

  async listBans(activeOnly: boolean) {
    return this.prisma.forumBan.findMany({
      where: activeOnly
        ? {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reason: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        user: { select: authorSelect },
        issuer: { select: authorSelect },
        course: { select: { id: true, title: true } },
      },
    });
  }

  async ban(input: BanInput, issuedBy: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw AppError.notFound();
    if (input.userId === issuedBy) {
      throw AppError.validation({ userId: ['Master tidak dapat mencabut haknya sendiri.'] });
    }
    if (input.expiresAt && input.expiresAt <= new Date()) {
      throw AppError.validation({ expiresAt: ['Waktu berakhir harus di masa depan.'] });
    }
    if (input.courseId) {
      const course = await this.prisma.course.count({ where: { id: input.courseId } });
      if (!course) throw AppError.validation({ courseId: ['Kursus tidak ditemukan.'] });
    }

    // Satu blokir aktif per cakupan sudah cukup; menumpuknya hanya membuat
    // pencabutan jadi ambigu.
    const existing = await this.prisma.forumBan.findFirst({
      where: {
        userId: input.userId,
        courseId: input.courseId ?? null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (existing) {
      throw AppError.validation({ userId: ['Pelajar ini sudah dicabut haknya pada cakupan itu.'] });
    }

    const ban = await this.prisma.forumBan.create({
      data: {
        userId: input.userId,
        courseId: input.courseId ?? null,
        reason: input.reason,
        expiresAt: input.expiresAt ?? null,
        issuedBy,
      },
      select: { id: true, reason: true, expiresAt: true, createdAt: true },
    });

    // ADR-018 mencatat ketiadaan pemberitahuan ini sebagai kekurangan:
    // sebelumnya pelajar baru tahu ketika mencoba menulis dan ditolak.
    await this.notifications.notify([input.userId], {
      type: 'FORUM_PARTICIPATION_REVOKED',
      title: 'Hak berdiskusimu dicabut sementara',
      body: input.expiresAt
        ? `${input.reason} Berlaku sampai ${input.expiresAt.toISOString()}.`
        : `${input.reason} Berlaku sampai dipulihkan Master.`,
      linkUrl: input.courseId ? `/learn/${input.courseId}/forum` : undefined,
    });
    return ban;
  }

  /** Mengembalikan hak berdiskusi. Barisnya ditandai, bukan dihapus. */
  async revokeBan(banId: string, revokedBy: string) {
    const ban = await this.prisma.forumBan.findFirst({
      where: { id: banId, revokedAt: null },
      select: { id: true, userId: true, courseId: true },
    });
    if (!ban) throw AppError.notFound();
    const revoked = await this.prisma.forumBan.update({
      where: { id: banId },
      data: { revokedAt: new Date(), revokedBy },
      select: { id: true, revokedAt: true },
    });

    await this.notifications.notify([ban.userId], {
      type: 'FORUM_PARTICIPATION_RESTORED',
      title: 'Hak berdiskusimu dipulihkan',
      body: 'Kamu dapat kembali menulis di forum.',
      linkUrl: ban.courseId ? `/learn/${ban.courseId}/forum` : undefined,
    });
    return revoked;
  }

  private async assertTopicExists(topicId: string): Promise<void> {
    const topic = await this.prisma.forumTopic.count({
      where: { id: topicId, deletedAt: null },
    });
    if (!topic) throw AppError.notFound();
  }
}
