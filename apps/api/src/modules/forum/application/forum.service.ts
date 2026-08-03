import { Injectable } from '@nestjs/common';
import { ForumTopicStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';
import { NotificationService } from '../../notification/application/notification.service';

/** Kolom penulis yang boleh dilihat pelajar lain (PRD butir 1146). */
const authorSelect = { id: true, fullName: true, avatarUrl: true } as const;

interface CreateTopicInput {
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  title: string;
  body: string;
}

interface ListTopicsInput {
  courseId: string;
  lessonId?: string;
  status?: ForumTopicStatus;
  search?: string;
  page: number;
  pageSize: number;
}

/**
 * Forum diskusi untuk pelajar (PRD 7.12).
 *
 * Semua jalur masuk memverifikasi dua hal berbeda yang mudah tertukar:
 * **akses kursus** (punya enrollment aktif) dan **hak berpartisipasi** (tidak
 * sedang dicabut Master). Pelajar yang dicabut haknya tetap boleh membaca,
 * tetapi tidak boleh menulis apa pun.
 */
@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Blokir yang sedang berlaku untuk pelajar di satu kursus.
   *
   * Blokir dengan `courseId` null berlaku di seluruh forum. Blokir yang sudah
   * dicabut atau kedaluwarsa tidak dihitung, tetapi barisnya tetap disimpan
   * sebagai riwayat moderasi.
   */
  async activeBan(userId: string, courseId: string) {
    return this.prisma.forumBan.findFirst({
      where: {
        userId,
        revokedAt: null,
        OR: [{ courseId: null }, { courseId }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, reason: true, expiresAt: true, courseId: true },
    });
  }

  private async assertCanWrite(userId: string, courseId: string): Promise<void> {
    await this.access.assertActiveAccess(userId, courseId);
    const ban = await this.activeBan(userId, courseId);
    if (!ban) return;
    const until = ban.expiresAt
      ? ` sampai ${ban.expiresAt.toISOString()}`
      : ' sampai dicabut Master';
    throw new AppError(
      'PERMISSION_DENIED',
      403,
      `Hak berdiskusi kamu sedang dicabut${until}. Alasan: ${ban.reason}`,
    );
  }

  // ─────────────────────────────────────────────
  // Membaca
  // ─────────────────────────────────────────────

  async listTopics(userId: string, input: ListTopicsInput) {
    await this.access.assertActiveAccess(userId, input.courseId);

    const where: Prisma.ForumTopicWhereInput = {
      courseId: input.courseId,
      deletedAt: null,
      // Konten hidden tidak terlihat oleh pelajar (PRD 7.12 acceptance criteria).
      status: input.status ?? { not: ForumTopicStatus.HIDDEN },
      ...(input.lessonId ? { lessonId: input.lessonId } : {}),
      ...(input.search
        ? {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { body: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    // Filter status eksplisit tidak boleh menjadi celah melihat konten hidden.
    if (input.status === ForumTopicStatus.HIDDEN) throw AppError.notFound();

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
          lessonId: true,
          moduleId: true,
          author: { select: authorSelect },
          _count: { select: { reactions: true } },
        },
      }),
    ]);

    return { total, topics };
  }

  async topicDetail(userId: string, topicId: string) {
    const topic = await this.prisma.forumTopic.findFirst({
      where: { id: topicId, deletedAt: null, status: { not: ForumTopicStatus.HIDDEN } },
      select: {
        id: true,
        courseId: true,
        moduleId: true,
        lessonId: true,
        title: true,
        body: true,
        status: true,
        isPinned: true,
        bestReplyId: true,
        replyCount: true,
        createdAt: true,
        updatedAt: true,
        author: { select: authorSelect },
        _count: { select: { reactions: true } },
      },
    });
    if (!topic) throw AppError.notFound();
    await this.access.assertActiveAccess(userId, topic.courseId);

    const replies = await this.prisma.forumReply.findMany({
      where: { topicId, deletedAt: null, isHidden: false },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        author: { select: authorSelect },
        _count: { select: { reactions: true } },
      },
    });

    // Reaksi milik pengguna ini diambil sekaligus untuk topik dan seluruh
    // balasannya. Tanpa penandanya, saklar suka tidak punya keadaan yang
    // terlihat: setelah halaman dimuat ulang, pengguna hanya melihat angka
    // dan tidak tahu apakah dirinya sudah termasuk di dalamnya.
    const reaksiSaya = await this.prisma.forumReaction.findMany({
      where: {
        userId,
        OR: [{ topicId }, { replyId: { in: replies.map((reply) => reply.id) } }],
      },
      select: { topicId: true, replyId: true },
    });
    const balasanDisukai = new Set(
      reaksiSaya.map((reaksi) => reaksi.replyId).filter((id): id is string => id !== null),
    );

    const ban = await this.activeBan(userId, topic.courseId);
    return {
      ...topic,
      replies: replies.map((reply) => ({
        ...reply,
        reactedByMe: balasanDisukai.has(reply.id),
      })),
      reactedByMe: reaksiSaya.some((reaksi) => reaksi.topicId === topicId),
      // Topik terkunci tidak dapat diubah maupun dihapus penulisnya, sama
      // seperti yang ditegakkan `updateTopic` dan `deleteTopic`.
      canManage: topic.author.id === userId && topic.status !== ForumTopicStatus.LOCKED,
      // Supaya antarmuka dapat menyembunyikan kotak balasan alih-alih membiarkan
      // pelajar mengetik panjang lebar lalu ditolak server.
      canParticipate: !ban && topic.status !== ForumTopicStatus.LOCKED,
      participationBlockedReason: ban ? ban.reason : null,
    };
  }

  // ─────────────────────────────────────────────
  // Menulis
  // ─────────────────────────────────────────────

  async createTopic(userId: string, input: CreateTopicInput) {
    await this.assertCanWrite(userId, input.courseId);
    await this.assertPlacement(input.courseId, input.moduleId, input.lessonId);

    const topic = await this.prisma.forumTopic.create({
      data: {
        courseId: input.courseId,
        moduleId: input.moduleId ?? null,
        lessonId: input.lessonId ?? null,
        authorId: userId,
        title: input.title,
        body: input.body,
      },
      select: { id: true, title: true, status: true, createdAt: true },
    });

    await this.notifications.notify(await this.moderatorIds(), {
      type: 'FORUM_NEW_TOPIC',
      title: 'Diskusi baru menunggu',
      body: `${input.title}`,
      linkUrl: '/master/forum',
    });
    return topic;
  }

  async updateTopic(userId: string, topicId: string, input: { title?: string; body?: string }) {
    const topic = await this.ownTopic(userId, topicId);
    if (topic.status === ForumTopicStatus.LOCKED) {
      throw new AppError('DISCUSSION_LOCKED', 409, 'Diskusi ini sudah dikunci Master.');
    }
    await this.assertCanWrite(userId, topic.courseId);

    return this.prisma.forumTopic.update({
      where: { id: topicId },
      data: { title: input.title, body: input.body },
      select: { id: true, title: true, body: true, updatedAt: true },
    });
  }

  async deleteTopic(userId: string, topicId: string): Promise<void> {
    const topic = await this.ownTopic(userId, topicId);
    if (topic.status === ForumTopicStatus.LOCKED) {
      throw new AppError('DISCUSSION_LOCKED', 409, 'Diskusi ini sudah dikunci Master.');
    }
    // Soft delete: balasan orang lain di dalamnya tidak boleh ikut lenyap dari
    // riwayat hanya karena penulis topik berubah pikiran.
    await this.prisma.forumTopic.update({
      where: { id: topicId },
      data: { deletedAt: new Date() },
    });
  }

  async createReply(userId: string, topicId: string, body: string) {
    const topic = await this.prisma.forumTopic.findFirst({
      where: { id: topicId, deletedAt: null, status: { not: ForumTopicStatus.HIDDEN } },
      select: { id: true, courseId: true, status: true },
    });
    if (!topic) throw AppError.notFound();
    if (topic.status === ForumTopicStatus.LOCKED) {
      throw new AppError('DISCUSSION_LOCKED', 409, 'Diskusi ini sudah dikunci Master.');
    }
    await this.assertCanWrite(userId, topic.courseId);

    const [reply] = await this.prisma.$transaction([
      this.prisma.forumReply.create({
        data: { topicId, authorId: userId, body },
        select: { id: true, body: true, createdAt: true },
      }),
      this.prisma.forumTopic.update({
        where: { id: topicId },
        data: { replyCount: { increment: 1 }, lastActivityAt: new Date() },
      }),
    ]);

    await this.notifyTopicAuthor(topicId, userId);
    return reply;
  }

  /** Memberi tahu penulis topik bahwa diskusinya dibalas orang lain. */
  private async notifyTopicAuthor(topicId: string, replierId: string): Promise<void> {
    const topic = await this.prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { id: true, title: true, authorId: true, courseId: true },
    });
    // Membalas diskusi sendiri tidak perlu diberitahukan.
    if (!topic || topic.authorId === replierId) return;

    await this.notifications.notify([topic.authorId], {
      type: 'FORUM_REPLY',
      title: 'Diskusimu mendapat balasan',
      body: topic.title,
      linkUrl: `/learn/${topic.courseId}/forum/${topic.id}`,
    });
  }

  /** Pemegang izin moderasi, yaitu penerima notifikasi Master. */
  private async moderatorIds(): Promise<string[]> {
    const moderators = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        roles: { some: { role: { permissions: { some: { permission: { code: 'discussions.moderate' } } } } } },
      },
      select: { id: true },
    });
    return moderators.map(({ id }) => id);
  }

  async updateReply(userId: string, replyId: string, body: string) {
    const reply = await this.ownReply(userId, replyId);
    if (reply.topic.status === ForumTopicStatus.LOCKED) {
      throw new AppError('DISCUSSION_LOCKED', 409, 'Diskusi ini sudah dikunci Master.');
    }
    await this.assertCanWrite(userId, reply.topic.courseId);

    return this.prisma.forumReply.update({
      where: { id: replyId },
      data: { body },
      select: { id: true, body: true, updatedAt: true },
    });
  }

  async deleteReply(userId: string, replyId: string): Promise<void> {
    const reply = await this.ownReply(userId, replyId);
    if (reply.topic.status === ForumTopicStatus.LOCKED) {
      throw new AppError('DISCUSSION_LOCKED', 409, 'Diskusi ini sudah dikunci Master.');
    }
    await this.prisma.$transaction([
      this.prisma.forumReply.update({
        where: { id: replyId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.forumTopic.update({
        where: { id: reply.topicId },
        data: { replyCount: { decrement: 1 } },
      }),
    ]);
  }

  // ─────────────────────────────────────────────
  // Reaksi dan laporan
  // ─────────────────────────────────────────────

  /** Menyalakan atau mematikan reaksi. Mengembalikan keadaan setelahnya. */
  async toggleReaction(
    userId: string,
    target: { topicId?: string; replyId?: string },
  ): Promise<{ reacted: boolean; total: number }> {
    const { courseId, topicId, replyId } = await this.resolveTarget(target);
    await this.assertCanWrite(userId, courseId);

    const existing = await this.prisma.forumReaction.findFirst({
      where: { userId, topicId: topicId ?? null, replyId: replyId ?? null },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.forumReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.forumReaction.create({
        data: { userId, topicId: topicId ?? null, replyId: replyId ?? null },
      });
    }
    const total = await this.prisma.forumReaction.count({
      where: { topicId: topicId ?? null, replyId: replyId ?? null },
    });
    return { reacted: !existing, total };
  }

  async report(userId: string, target: { topicId?: string; replyId?: string }, reason: string) {
    const { courseId, topicId, replyId } = await this.resolveTarget(target);
    // Melaporkan tetap boleh meski hak menulis dicabut: justru pelajar yang
    // bermasalah pun harus bisa melaporkan penyalahgunaan terhadap dirinya.
    await this.access.assertActiveAccess(userId, courseId);

    const report = await this.prisma.forumReport.create({
      data: { reporterId: userId, topicId: topicId ?? null, replyId: replyId ?? null, reason },
      select: { id: true, status: true, createdAt: true },
    });

    await this.notifications.notify(await this.moderatorIds(), {
      type: 'FORUM_CONTENT_REPORTED',
      title: 'Konten forum dilaporkan',
      body: reason.slice(0, 200),
      linkUrl: '/master/forum',
    });
    return report;
  }

  // ─────────────────────────────────────────────
  // Pembantu
  // ─────────────────────────────────────────────

  /** Memastikan modul/pelajaran yang dirujuk benar-benar milik kursus itu. */
  private async assertPlacement(
    courseId: string,
    moduleId?: string,
    lessonId?: string,
  ): Promise<void> {
    if (moduleId) {
      const found = await this.prisma.courseModule.count({ where: { id: moduleId, courseId } });
      if (!found) throw AppError.validation({ moduleId: ['Modul bukan bagian dari kursus ini.'] });
    }
    if (lessonId) {
      const found = await this.prisma.lesson.count({
        where: { id: lessonId, module: { courseId } },
      });
      if (!found) {
        throw AppError.validation({ lessonId: ['Pelajaran bukan bagian dari kursus ini.'] });
      }
    }
  }

  private async ownTopic(userId: string, topicId: string) {
    const topic = await this.prisma.forumTopic.findFirst({
      where: { id: topicId, deletedAt: null, status: { not: ForumTopicStatus.HIDDEN } },
      select: { id: true, authorId: true, courseId: true, status: true },
    });
    if (!topic) throw AppError.notFound();
    // Bukan miliknya: jangan bocorkan bahwa topiknya ada dengan pesan berbeda.
    if (topic.authorId !== userId) throw AppError.permissionDenied();
    return topic;
  }

  private async ownReply(userId: string, replyId: string) {
    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, deletedAt: null, isHidden: false },
      select: {
        id: true,
        authorId: true,
        topicId: true,
        topic: { select: { courseId: true, status: true, deletedAt: true } },
      },
    });
    if (!reply || reply.topic.deletedAt) throw AppError.notFound();
    if (reply.authorId !== userId) throw AppError.permissionDenied();
    return reply;
  }

  /** Memetakan topik atau balasan ke kursusnya, sekaligus menolak target ganda. */
  private async resolveTarget(target: { topicId?: string; replyId?: string }) {
    const { topicId, replyId } = target;
    if ((topicId && replyId) || (!topicId && !replyId)) {
      throw AppError.validation({ target: ['Isi salah satu dari topicId atau replyId.'] });
    }
    if (topicId) {
      const topic = await this.prisma.forumTopic.findFirst({
        where: { id: topicId, deletedAt: null, status: { not: ForumTopicStatus.HIDDEN } },
        select: { courseId: true },
      });
      if (!topic) throw AppError.notFound();
      return { courseId: topic.courseId, topicId, replyId: undefined };
    }
    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, deletedAt: null, isHidden: false },
      select: { topic: { select: { courseId: true, deletedAt: true, status: true } } },
    });
    if (!reply || reply.topic.deletedAt || reply.topic.status === ForumTopicStatus.HIDDEN) {
      throw AppError.notFound();
    }
    return { courseId: reply.topic.courseId, topicId: undefined, replyId };
  }
}
