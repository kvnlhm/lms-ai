import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
// Diimpor, bukan disalin: acceptance criteria PRD 9 menuntut data ekspor sesuai
// dengan dashboard, dan dua salinan aturan risiko akan berbeda cepat atau
// lambat — mula-mula hanya pada ambangnya, lalu pada siapa yang disebut
// berisiko.
import { classifyRisk, type RiskLevel } from '../../analytics/application/learner-insights.service';
import type { CsvTable } from './csv';

export const REPORT_KEYS = [
  'users',
  'enrollments',
  'progress',
  'course-completions',
  'learning-activity',
  'inactive-users',
  'at-risk-users',
  'forum',
  'course-performance',
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_LABELS: Record<ReportKey, string> = {
  users: 'Laporan pengguna',
  enrollments: 'Laporan enrollment',
  progress: 'Laporan progres',
  'course-completions': 'Laporan penyelesaian kursus',
  'learning-activity': 'Laporan aktivitas belajar',
  'inactive-users': 'Laporan pengguna tidak aktif',
  'at-risk-users': 'Laporan pengguna berisiko',
  forum: 'Laporan forum',
  'course-performance': 'Laporan performa kursus',
};

export interface ReportFilter {
  courseId?: string;
  from?: Date;
  to?: Date;
  /** Ambang hari tanpa aktivitas untuk laporan pengguna tidak aktif. */
  inactiveDays?: number;
}

/** Batas baris per ekspor; melampauinya berarti berkasnya perlu dipecah. */
const MAX_ROWS = 50_000;

const DAY_MS = 86_400_000;

/**
 * Sembilan laporan CSV pada PRD 9.
 *
 * Angkanya sengaja dihitung dari tabel yang sama dengan yang dipakai dashboard,
 * bukan dari salinan terpisah — acceptance criteria menuntut "data ekspor
 * sesuai dengan dashboard", dan dua sumber kebenaran akan berbeda cepat atau
 * lambat.
 */
@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(key: ReportKey, filter: ReportFilter): Promise<CsvTable> {
    switch (key) {
      case 'users':
        return this.users(filter);
      case 'enrollments':
        return this.enrollments(filter);
      case 'progress':
        return this.progress(filter);
      case 'course-completions':
        return this.courseCompletions(filter);
      case 'learning-activity':
        return this.learningActivity(filter);
      case 'inactive-users':
        return this.inactiveUsers(filter);
      case 'at-risk-users':
        return this.atRiskUsers();
      case 'forum':
        return this.forum(filter);
      case 'course-performance':
        return this.coursePerformance(filter);
      default:
        throw AppError.notFound();
    }
  }

  /** Rentang waktu yang dipakai bersama beberapa laporan. */
  private createdRange(filter: ReportFilter) {
    if (!filter.from && !filter.to) return {};
    return {
      createdAt: {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      },
    };
  }

  private guardSize(count: number): void {
    if (count > MAX_ROWS) {
      throw AppError.validation({
        _: [
          `Laporan ini menghasilkan ${count.toLocaleString('id-ID')} baris, melebihi batas ` +
            `${MAX_ROWS.toLocaleString('id-ID')}. Persempit rentang waktu atau pilih satu kursus.`,
        ],
      });
    }
  }

  // ── 1. Pengguna ────────────────────────────────────────────

  private async users(filter: ReportFilter): Promise<CsvTable> {
    const where: Prisma.UserWhereInput = { deletedAt: null, ...this.createdRange(filter) };
    this.guardSize(await this.prisma.user.count({ where }));

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // Password hash, rahasia MFA, dan token sengaja tidak diambil sama
      // sekali: yang tidak diambil tidak dapat bocor lewat berkas ini.
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { select: { role: { select: { code: true } } } },
        _count: { select: { enrollments: true } },
      },
    });

    return {
      headers: [
        'ID',
        'Nama',
        'Email',
        'Telepon',
        'Role',
        'Status',
        'Email terverifikasi',
        'Login terakhir',
        'Jumlah enrollment',
        'Terdaftar',
      ],
      rows: rows.map((user) => [
        user.id,
        user.fullName,
        user.email,
        user.phone,
        user.roles[0]?.role.code ?? '',
        user.status,
        user.emailVerifiedAt,
        user.lastLoginAt,
        user._count.enrollments,
        user.createdAt,
      ]),
    };
  }

  // ── 2. Enrollment ──────────────────────────────────────────

  private async enrollments(filter: ReportFilter): Promise<CsvTable> {
    const where: Prisma.EnrollmentWhereInput = {
      ...(filter.courseId ? { courseId: filter.courseId } : {}),
      ...(filter.from || filter.to
        ? {
            enrolledAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };
    this.guardSize(await this.prisma.enrollment.count({ where }));

    const rows = await this.prisma.enrollment.findMany({
      where,
      orderBy: { enrolledAt: 'desc' },
      select: {
        id: true,
        status: true,
        enrolledAt: true,
        completedAt: true,
        removedAt: true,
        user: { select: { fullName: true, email: true } },
        course: { select: { title: true } },
        actor: { select: { fullName: true } },
      },
    });

    return {
      headers: [
        'ID',
        'Pelajar',
        'Email',
        'Kursus',
        'Status',
        'Terdaftar',
        'Selesai',
        'Dikeluarkan',
        'Didaftarkan oleh',
      ],
      rows: rows.map((row) => [
        row.id,
        row.user.fullName,
        row.user.email,
        row.course.title,
        row.status,
        row.enrolledAt,
        row.completedAt,
        row.removedAt,
        row.actor?.fullName ?? 'Mandiri',
      ]),
    };
  }

  // ── 3. Progres ─────────────────────────────────────────────

  private async progress(filter: ReportFilter): Promise<CsvTable> {
    const where: Prisma.CourseProgressWhereInput = {
      enrollment: {
        ...(filter.courseId ? { courseId: filter.courseId } : {}),
      },
      ...(filter.from || filter.to
        ? {
            lastActivityAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };
    this.guardSize(await this.prisma.courseProgress.count({ where }));

    const rows = await this.prisma.courseProgress.findMany({
      where,
      orderBy: { progressPercent: 'desc' },
      select: {
        progressPercent: true,
        requiredLessonsTotal: true,
        requiredLessonsComplete: true,
        startedAt: true,
        lastActivityAt: true,
        completedAt: true,
        enrollment: {
          select: {
            status: true,
            user: { select: { fullName: true, email: true } },
            course: { select: { title: true } },
          },
        },
      },
    });

    return {
      headers: [
        'Pelajar',
        'Email',
        'Kursus',
        'Status enrollment',
        'Progres (%)',
        'Materi wajib selesai',
        'Materi wajib total',
        'Mulai',
        'Aktivitas terakhir',
        'Selesai',
      ],
      rows: rows.map((row) => [
        row.enrollment.user.fullName,
        row.enrollment.user.email,
        row.enrollment.course.title,
        row.enrollment.status,
        Number(row.progressPercent),
        row.requiredLessonsComplete,
        row.requiredLessonsTotal,
        row.startedAt,
        row.lastActivityAt,
        row.completedAt,
      ]),
    };
  }

  // ── 4. Penyelesaian kursus ─────────────────────────────────

  private async courseCompletions(filter: ReportFilter): Promise<CsvTable> {
    const where: Prisma.CourseProgressWhereInput = {
      completedAt: {
        not: null,
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      },
      ...(filter.courseId ? { enrollment: { courseId: filter.courseId } } : {}),
    };
    this.guardSize(await this.prisma.courseProgress.count({ where }));

    const rows = await this.prisma.courseProgress.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      select: {
        startedAt: true,
        completedAt: true,
        enrollment: {
          select: {
            enrolledAt: true,
            user: { select: { fullName: true, email: true } },
            course: { select: { title: true, estimatedMinutes: true } },
          },
        },
      },
    });

    return {
      headers: [
        'Pelajar',
        'Email',
        'Kursus',
        'Terdaftar',
        'Mulai belajar',
        'Selesai',
        'Hari sampai selesai',
        'Estimasi durasi (menit)',
      ],
      rows: rows.map((row) => {
        const from = row.startedAt ?? row.enrollment.enrolledAt;
        const days = row.completedAt
          ? Math.max(0, Math.round((row.completedAt.getTime() - from.getTime()) / DAY_MS))
          : null;
        return [
          row.enrollment.user.fullName,
          row.enrollment.user.email,
          row.enrollment.course.title,
          row.enrollment.enrolledAt,
          row.startedAt,
          row.completedAt,
          days,
          row.enrollment.course.estimatedMinutes,
        ];
      }),
    };
  }

  // ── 5. Aktivitas belajar ───────────────────────────────────

  private async learningActivity(filter: ReportFilter): Promise<CsvTable> {
    // Tanpa rentang waktu, laporan ini akan menarik seluruh riwayat event.
    // Default 30 hari terakhir menjaga ekspor tetap dapat dibuka.
    const from = filter.from ?? new Date(Date.now() - 30 * DAY_MS);
    const to = filter.to;

    const rows = await this.prisma.$queryRaw<
      {
        user_id: string | null;
        full_name: string | null;
        email: string | null;
        course_title: string | null;
        events: bigint;
        active_days: bigint;
        total_seconds: bigint | null;
        last_activity_at: Date | null;
      }[]
    >(Prisma.sql`
      SELECT
        le."user_id",
        u."full_name",
        u."email"::text AS email,
        c."title" AS course_title,
        COUNT(*)::bigint AS events,
        COUNT(DISTINCT date_trunc('day', le."occurred_at"))::bigint AS active_days,
        SUM(COALESCE(le."duration_seconds", 0))::bigint AS total_seconds,
        MAX(le."occurred_at") AS last_activity_at
      FROM "learning_events" le
      LEFT JOIN "users" u ON u."id" = le."user_id"
      LEFT JOIN "courses" c ON c."id" = le."course_id"
      WHERE le."occurred_at" >= ${from}
        ${to ? Prisma.sql`AND le."occurred_at" <= ${to}` : Prisma.empty}
        ${filter.courseId ? Prisma.sql`AND le."course_id" = ${filter.courseId}::uuid` : Prisma.empty}
      GROUP BY le."user_id", u."full_name", u."email", c."title"
      ORDER BY events DESC
      LIMIT ${MAX_ROWS}
    `);

    return {
      headers: [
        'Pelajar',
        'Email',
        'Kursus',
        'Jumlah aktivitas',
        'Hari aktif',
        'Total waktu (menit)',
        'Aktivitas terakhir',
      ],
      rows: rows.map((row) => [
        row.full_name ?? 'Tidak diketahui',
        row.email ?? '',
        row.course_title ?? 'Tanpa kursus',
        Number(row.events),
        Number(row.active_days),
        Math.round(Number(row.total_seconds ?? 0) / 60),
        row.last_activity_at,
      ]),
    };
  }

  // ── 6. Pengguna tidak aktif ────────────────────────────────

  private async inactiveUsers(filter: ReportFilter): Promise<CsvTable> {
    const days = filter.inactiveDays ?? 30;
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        full_name: string;
        email: string;
        status: string;
        created_at: Date;
        last_activity_at: Date | null;
        enrollments: bigint;
      }[]
    >(Prisma.sql`
      WITH last_seen AS (
        SELECT "user_id", MAX("occurred_at") AS last_activity_at
        FROM "learning_events" WHERE "user_id" IS NOT NULL GROUP BY "user_id"
      )
      SELECT
        u."id", u."full_name", u."email"::text AS email, u."status"::text AS status,
        u."created_at", ls.last_activity_at,
        COUNT(e."id")::bigint AS enrollments
      FROM "users" u
      LEFT JOIN last_seen ls ON ls."user_id" = u."id"
      LEFT JOIN "enrollments" e ON e."user_id" = u."id" AND e."status" = 'ACTIVE'
      WHERE u."deleted_at" IS NULL
        -- Yang belum pernah aktif sama sekali ikut dihitung tidak aktif;
        -- justru merekalah yang paling perlu dihubungi.
        AND (ls.last_activity_at IS NULL OR ls.last_activity_at < ${cutoff})
      GROUP BY u."id", u."full_name", u."email", u."status", u."created_at", ls.last_activity_at
      ORDER BY ls.last_activity_at ASC NULLS FIRST
      LIMIT ${MAX_ROWS}
    `);

    return {
      headers: [
        'ID',
        'Nama',
        'Email',
        'Status',
        'Terdaftar',
        'Aktivitas terakhir',
        'Hari tidak aktif',
        'Enrollment aktif',
      ],
      rows: rows.map((row) => [
        row.id,
        row.full_name,
        row.email,
        row.status,
        row.created_at,
        row.last_activity_at,
        row.last_activity_at
          ? Math.floor((Date.now() - row.last_activity_at.getTime()) / DAY_MS)
          : 'Belum pernah',
        Number(row.enrollments),
      ]),
    };
  }

  // ── 7. Pengguna berisiko ───────────────────────────────────

  /** Tanpa penyaring: risiko dinilai atas seluruh pelajar aktif, seperti dashboard. */
  private async atRiskUsers(): Promise<CsvTable> {
    const rows = await this.prisma.$queryRaw<
      {
        user_id: string;
        full_name: string;
        email: string;
        last_activity_at: Date | null;
        enrolled_at: Date | null;
        average_progress: number | null;
      }[]
    >(Prisma.sql`
      WITH last_seen AS (
        SELECT "user_id", MAX("occurred_at") AS last_activity_at
        FROM "learning_events" WHERE "user_id" IS NOT NULL GROUP BY "user_id"
      )
      SELECT
        u."id" AS user_id, u."full_name", u."email"::text AS email,
        MAX(ls.last_activity_at) AS last_activity_at,
        MIN(e."enrolled_at") AS enrolled_at,
        AVG(COALESCE(cp."progress_percent", 0))::float AS average_progress
      FROM "users" u
      JOIN "enrollments" e ON e."user_id" = u."id" AND e."status" = 'ACTIVE'
      LEFT JOIN "course_progress" cp ON cp."enrollment_id" = e."id"
      LEFT JOIN last_seen ls ON ls."user_id" = u."id"
      WHERE u."deleted_at" IS NULL AND u."status" = 'ACTIVE'
      GROUP BY u."id", u."full_name", u."email"
    `);

    const now = Date.now();
    const averages = rows.map((row) => Number(row.average_progress ?? 0));
    // Perhitungan dan pembulatannya mengikuti LearnerInsightsService persis;
    // selisih satu angka di belakang koma cukup untuk memindahkan seseorang
    // melewati ambang MEDIUM.
    const courseAverage = averages.length
      ? round(averages.reduce((total, value) => total + value, 0) / averages.length, 1)
      : 0;

    const scored = rows
      .map((row) => {
        const daysInactive = row.last_activity_at
          ? Math.floor((now - row.last_activity_at.getTime()) / DAY_MS)
          : null;
        const averageProgress = round(Number(row.average_progress ?? 0), 1);
        const { level, reason } = classifyRisk({
          daysInactive,
          daysSinceEnrolled: row.enrolled_at
            ? Math.floor((now - row.enrolled_at.getTime()) / DAY_MS)
            : null,
          averageProgress,
          courseAverageProgress: courseAverage,
        });
        return { row, level, reason, daysInactive, averageProgress };
      })
      .filter((entry) => entry.level !== 'LOW')
      .sort((a, b) => RISK_ORDER[b.level] - RISK_ORDER[a.level]);

    return {
      headers: [
        'Pelajar',
        'Email',
        'Tingkat risiko',
        'Alasan',
        'Rata-rata progres (%)',
        'Hari tidak aktif',
        'Aktivitas terakhir',
      ],
      rows: scored.map((entry) => [
        entry.row.full_name,
        entry.row.email,
        entry.level,
        entry.reason,
        entry.averageProgress,
        entry.daysInactive ?? 'Belum pernah',
        entry.row.last_activity_at,
      ]),
    };
  }

  // ── 8. Forum ───────────────────────────────────────────────

  private async forum(filter: ReportFilter): Promise<CsvTable> {
    const where: Prisma.ForumTopicWhereInput = {
      deletedAt: null,
      ...(filter.courseId ? { courseId: filter.courseId } : {}),
      ...this.createdRange(filter),
    };
    this.guardSize(await this.prisma.forumTopic.count({ where }));

    const rows = await this.prisma.forumTopic.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        replyCount: true,
        bestReplyId: true,
        isPinned: true,
        createdAt: true,
        lastActivityAt: true,
        moderatedAt: true,
        course: { select: { title: true } },
        author: { select: { fullName: true } },
        _count: { select: { reports: true } },
      },
    });

    return {
      headers: [
        'ID',
        'Judul',
        'Kursus',
        'Penulis',
        'Status',
        'Jumlah balasan',
        'Sudah terjawab',
        'Disematkan',
        'Laporan konten',
        'Dimoderasi',
        'Dibuat',
        'Aktivitas terakhir',
      ],
      rows: rows.map((topic) => [
        topic.id,
        topic.title,
        topic.course.title,
        topic.author.fullName,
        topic.status,
        topic.replyCount,
        topic.bestReplyId !== null,
        topic.isPinned,
        topic._count.reports,
        topic.moderatedAt,
        topic.createdAt,
        topic.lastActivityAt,
      ]),
    };
  }

  // ── 9. Performa kursus ─────────────────────────────────────

  private async coursePerformance(filter: ReportFilter): Promise<CsvTable> {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        title: string;
        status: string;
        level: string;
        enrollments: bigint;
        completions: bigint;
        average_progress: number | null;
        topics: bigint;
        published_at: Date | null;
      }[]
    >(Prisma.sql`
      SELECT
        c."id", c."title", c."status"::text AS status, c."level"::text AS level,
        c."published_at",
        COUNT(DISTINCT e."id")::bigint AS enrollments,
        COUNT(DISTINCT cp."id") FILTER (WHERE cp."completed_at" IS NOT NULL)::bigint AS completions,
        AVG(COALESCE(cp."progress_percent", 0))::float AS average_progress,
        COUNT(DISTINCT ft."id")::bigint AS topics
      FROM "courses" c
      LEFT JOIN "enrollments" e ON e."course_id" = c."id" AND e."status" <> 'REMOVED'
      LEFT JOIN "course_progress" cp ON cp."enrollment_id" = e."id"
      LEFT JOIN "forum_topics" ft ON ft."course_id" = c."id" AND ft."deleted_at" IS NULL
      ${filter.courseId ? Prisma.sql`WHERE c."id" = ${filter.courseId}::uuid` : Prisma.empty}
      GROUP BY c."id", c."title", c."status", c."level", c."published_at"
      ORDER BY enrollments DESC
    `);

    return {
      headers: [
        'ID',
        'Kursus',
        'Status',
        'Level',
        'Terbit',
        'Jumlah enrollment',
        'Jumlah penyelesaian',
        'Tingkat penyelesaian (%)',
        'Rata-rata progres (%)',
        'Topik forum',
      ],
      rows: rows.map((row) => {
        const enrollments = Number(row.enrollments);
        const completions = Number(row.completions);
        return [
          row.id,
          row.title,
          row.status,
          row.level,
          row.published_at,
          enrollments,
          completions,
          enrollments > 0 ? Math.round((completions / enrollments) * 1000) / 10 : 0,
          Math.round(Number(row.average_progress ?? 0) * 10) / 10,
          Number(row.topics),
        ];
      }),
    };
  }
}

const RISK_ORDER: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** Pembulatan yang sama dengan dashboard, supaya ambang risikonya jatuh sama. */
function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
