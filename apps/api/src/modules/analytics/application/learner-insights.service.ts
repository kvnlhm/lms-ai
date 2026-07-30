import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const DAY_MS = 86_400_000;

const WEEKDAY_LABEL = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

interface HabitRow {
  dau: bigint;
  wau: bigint;
  mau: bigint;
  returning_learners: bigint;
  learner_days: bigint;
  distinct_learners: bigint;
  active_seconds: bigint;
}

interface PeakRow {
  bucket: number;
  events: bigint;
}

interface RetentionRow {
  previous_cohort: bigint;
  retained: bigint;
}

interface ForumRow {
  contributors: bigint;
  active_learners: bigint;
  topics: bigint;
  replies: bigint;
}

interface ContributorRow {
  user_id: string;
  full_name: string;
  topics: bigint;
  replies: bigint;
}

interface RiskRow {
  user_id: string;
  full_name: string;
  email: string;
  last_activity_at: Date | null;
  enrolled_at: Date | null;
  average_progress: Prisma.Decimal | null;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LearnerRisk {
  userId: string;
  fullName: string;
  email: string;
  level: RiskLevel;
  reason: string;
  daysInactive: number | null;
  averageProgress: number;
}

/**
 * Menentukan risk level seorang pelajar memakai aturan PRD 8.6.
 *
 * Sengaja rule-based dan murni, bukan query: aturannya perlu dapat diuji
 * tanpa database, dan PRD memang menetapkan MVP tidak memakai skoring.
 */
export function classifyRisk(input: {
  daysInactive: number | null;
  daysSinceEnrolled: number | null;
  averageProgress: number;
  courseAverageProgress: number;
}): { level: RiskLevel; reason: string } {
  const { daysInactive, daysSinceEnrolled, averageProgress, courseAverageProgress } = input;

  // Belum pernah beraktivitas sama sekali.
  if (daysInactive === null) {
    if (daysSinceEnrolled !== null && daysSinceEnrolled >= 14) {
      return {
        level: 'HIGH',
        reason: `Belum pernah memulai kursus padahal terdaftar ${daysSinceEnrolled} hari lalu.`,
      };
    }
    return { level: 'LOW', reason: 'Baru terdaftar dan belum mulai belajar.' };
  }

  if (daysInactive >= 14) {
    return { level: 'HIGH', reason: `Tidak aktif selama ${daysInactive} hari.` };
  }
  if (daysInactive >= 7) {
    return { level: 'MEDIUM', reason: `Tidak aktif selama ${daysInactive} hari.` };
  }
  // Progres tertinggal jauh dari rata-rata, meski masih aktif.
  if (courseAverageProgress > 0 && averageProgress < courseAverageProgress / 2) {
    return {
      level: 'MEDIUM',
      reason: `Progres ${averageProgress}% jauh di bawah rata-rata ${courseAverageProgress}%.`,
    };
  }
  return { level: 'LOW', reason: `Aktif ${daysInactive} hari lalu dan progres wajar.` };
}

@Injectable()
export class LearnerInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async insights(days: number) {
    const now = Date.now();
    const since = new Date(now - days * DAY_MS);

    const [habit, weekday, hour, retention7, retention30, forum, contributors, risks] =
      await Promise.all([
        this.habitTotals(since, now),
        this.peak(since, 'dow'),
        this.peak(since, 'hour'),
        this.returnRate(now, 7),
        this.returnRate(now, 30),
        this.forumParticipation(since),
        this.topContributors(since),
        this.riskBoard(now),
      ]);

    const learnerDays = Number(habit.learner_days);
    const distinctLearners = Number(habit.distinct_learners);
    const activeMinutes = Number(habit.active_seconds) / 60;

    return {
      periodDays: days,
      habit: {
        dailyActiveLearners: Number(habit.dau),
        weeklyActiveLearners: Number(habit.wau),
        monthlyActiveLearners: Number(habit.mau),
        // Berapa hari berbeda seorang pelajar belajar dalam periode ini.
        averageStudyDaysPerLearner: distinctLearners
          ? round(learnerDays / distinctLearners, 1)
          : 0,
        averageMinutesPerStudyDay: learnerDays ? round(activeMinutes / learnerDays, 1) : 0,
        returningLearners: Number(habit.returning_learners),
        busiestWeekday: weekday ? WEEKDAY_LABEL[weekday.bucket] ?? null : null,
        busiestHour: hour ? hour.bucket : null,
      },
      retention: {
        sevenDay: retention7,
        thirtyDay: retention30,
      },
      forum: {
        participationRate: forum.rate,
        contributors: Number(forum.raw.contributors),
        activeLearners: Number(forum.raw.active_learners),
        topics: Number(forum.raw.topics),
        replies: Number(forum.raw.replies),
        topContributors: contributors.map((row) => ({
          userId: row.user_id,
          fullName: row.full_name,
          topics: Number(row.topics),
          replies: Number(row.replies),
        })),
      },
      risk: {
        counts: {
          LOW: risks.filter((r) => r.level === 'LOW').length,
          MEDIUM: risks.filter((r) => r.level === 'MEDIUM').length,
          HIGH: risks.filter((r) => r.level === 'HIGH').length,
        },
        // Yang perlu ditindak lebih dulu ditaruh di depan.
        learners: risks
          .filter((r) => r.level !== 'LOW')
          .sort((a, b) => (b.daysInactive ?? 9_999) - (a.daysInactive ?? 9_999))
          .slice(0, 50),
      },
    };
  }

  private async habitTotals(since: Date, now: number): Promise<HabitRow> {
    const [row] = await this.prisma.$queryRaw<HabitRow[]>(Prisma.sql`
      WITH windowed AS (
        SELECT "user_id", date_trunc('day', "occurred_at") AS day, "duration_seconds", "occurred_at"
        FROM "learning_events"
        WHERE "occurred_at" >= ${since} AND "user_id" IS NOT NULL
      ),
      per_learner AS (
        SELECT "user_id", COUNT(DISTINCT day)::bigint AS active_days
        FROM windowed GROUP BY "user_id"
      )
      SELECT
        (SELECT COUNT(DISTINCT "user_id") FROM windowed
          WHERE "occurred_at" >= ${new Date(now - DAY_MS)})::bigint AS dau,
        (SELECT COUNT(DISTINCT "user_id") FROM windowed
          WHERE "occurred_at" >= ${new Date(now - 7 * DAY_MS)})::bigint AS wau,
        (SELECT COUNT(DISTINCT "user_id") FROM windowed
          WHERE "occurred_at" >= ${new Date(now - 30 * DAY_MS)})::bigint AS mau,
        (SELECT COUNT(*) FROM per_learner WHERE active_days >= 2)::bigint AS returning_learners,
        (SELECT COALESCE(SUM(active_days), 0) FROM per_learner)::bigint AS learner_days,
        (SELECT COUNT(*) FROM per_learner)::bigint AS distinct_learners,
        (SELECT COALESCE(SUM("duration_seconds"), 0) FROM windowed)::bigint AS active_seconds
    `);
    return row;
  }

  /** Ember waktu paling ramai: hari dalam pekan (`dow`) atau jam (`hour`). */
  private async peak(since: Date, unit: 'dow' | 'hour'): Promise<PeakRow | null> {
    const field = unit === 'dow' ? Prisma.sql`DOW` : Prisma.sql`HOUR`;
    const rows = await this.prisma.$queryRaw<PeakRow[]>(Prisma.sql`
      SELECT EXTRACT(${field} FROM "occurred_at")::int AS bucket, COUNT(*)::bigint AS events
      FROM "learning_events"
      WHERE "occurred_at" >= ${since}
      GROUP BY 1 ORDER BY events DESC, bucket ASC LIMIT 1
    `);
    return rows[0] ?? null;
  }

  /**
   * Berapa persen pelajar yang aktif pada periode sebelumnya kembali belajar
   * pada periode terakhir. Definisi ini dipilih karena dapat dihitung tanpa
   * tabel kohort terpisah, dan artinya lugas: "yang kembali".
   */
  private async returnRate(now: number, window: number): Promise<number> {
    const recentStart = new Date(now - window * DAY_MS);
    const previousStart = new Date(now - 2 * window * DAY_MS);
    const [row] = await this.prisma.$queryRaw<RetentionRow[]>(Prisma.sql`
      WITH previous AS (
        SELECT DISTINCT "user_id" FROM "learning_events"
        WHERE "user_id" IS NOT NULL
          AND "occurred_at" >= ${previousStart} AND "occurred_at" < ${recentStart}
      ),
      recent AS (
        SELECT DISTINCT "user_id" FROM "learning_events"
        WHERE "user_id" IS NOT NULL AND "occurred_at" >= ${recentStart}
      )
      SELECT
        (SELECT COUNT(*) FROM previous)::bigint AS previous_cohort,
        (SELECT COUNT(*) FROM previous p JOIN recent r ON r."user_id" = p."user_id")::bigint AS retained
    `);
    const cohort = Number(row.previous_cohort);
    return cohort ? round((Number(row.retained) / cohort) * 100, 1) : 0;
  }

  private async forumParticipation(since: Date) {
    const [raw] = await this.prisma.$queryRaw<ForumRow[]>(Prisma.sql`
      WITH authors AS (
        SELECT "author_id" AS user_id FROM "forum_topics"
          WHERE "created_at" >= ${since} AND "deleted_at" IS NULL
        UNION
        SELECT "author_id" FROM "forum_replies"
          WHERE "created_at" >= ${since} AND "deleted_at" IS NULL
      )
      SELECT
        (SELECT COUNT(*) FROM authors)::bigint AS contributors,
        (SELECT COUNT(DISTINCT "user_id") FROM "learning_events"
          WHERE "occurred_at" >= ${since} AND "user_id" IS NOT NULL)::bigint AS active_learners,
        (SELECT COUNT(*) FROM "forum_topics"
          WHERE "created_at" >= ${since} AND "deleted_at" IS NULL)::bigint AS topics,
        (SELECT COUNT(*) FROM "forum_replies"
          WHERE "created_at" >= ${since} AND "deleted_at" IS NULL)::bigint AS replies
    `);
    const active = Number(raw.active_learners);
    return { raw, rate: active ? round((Number(raw.contributors) / active) * 100, 1) : 0 };
  }

  private async topContributors(since: Date): Promise<ContributorRow[]> {
    return this.prisma.$queryRaw<ContributorRow[]>(Prisma.sql`
      WITH tallies AS (
        SELECT "author_id" AS user_id, COUNT(*)::bigint AS topics, 0::bigint AS replies
        FROM "forum_topics" WHERE "created_at" >= ${since} AND "deleted_at" IS NULL
        GROUP BY 1
        UNION ALL
        SELECT "author_id", 0::bigint, COUNT(*)::bigint
        FROM "forum_replies" WHERE "created_at" >= ${since} AND "deleted_at" IS NULL
        GROUP BY 1
      )
      SELECT t.user_id, u."full_name", SUM(t.topics)::bigint AS topics, SUM(t.replies)::bigint AS replies
      FROM tallies t JOIN "users" u ON u."id" = t.user_id
      GROUP BY t.user_id, u."full_name"
      ORDER BY (SUM(t.topics) + SUM(t.replies)) DESC
      LIMIT 10
    `);
  }

  private async riskBoard(now: number): Promise<LearnerRisk[]> {
    const rows = await this.prisma.$queryRaw<RiskRow[]>(Prisma.sql`
      WITH last_seen AS (
        SELECT "user_id", MAX("occurred_at") AS last_activity_at
        FROM "learning_events" WHERE "user_id" IS NOT NULL GROUP BY "user_id"
      )
      SELECT
        u."id" AS user_id,
        u."full_name",
        u."email"::text AS email,
        MAX(ls.last_activity_at) AS last_activity_at,
        MIN(e."enrolled_at") AS enrolled_at,
        AVG(COALESCE(cp."progress_percent", 0)) AS average_progress
      FROM "users" u
      JOIN "enrollments" e ON e."user_id" = u."id" AND e."status" = 'ACTIVE'
      LEFT JOIN "course_progress" cp ON cp."enrollment_id" = e."id"
      LEFT JOIN last_seen ls ON ls."user_id" = u."id"
      WHERE u."deleted_at" IS NULL AND u."status" = 'ACTIVE'
      GROUP BY u."id", u."full_name", u."email"
    `);

    const progresses = rows.map((row) => Number(row.average_progress ?? 0));
    const courseAverage = progresses.length
      ? round(progresses.reduce((total, value) => total + value, 0) / progresses.length, 1)
      : 0;

    return rows.map((row) => {
      const daysInactive = row.last_activity_at
        ? Math.floor((now - row.last_activity_at.getTime()) / DAY_MS)
        : null;
      const daysSinceEnrolled = row.enrolled_at
        ? Math.floor((now - row.enrolled_at.getTime()) / DAY_MS)
        : null;
      const averageProgress = round(Number(row.average_progress ?? 0), 1);
      const { level, reason } = classifyRisk({
        daysInactive,
        daysSinceEnrolled,
        averageProgress,
        courseAverageProgress: courseAverage,
      });
      return {
        userId: row.user_id,
        fullName: row.full_name,
        email: row.email,
        level,
        reason,
        daysInactive,
        averageProgress,
      };
    });
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
