import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

interface CourseRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  lesson_opens: bigint;
  lesson_completions: bigint;
  active_learners: bigint;
  enrollment_count: bigint;
  completed_enrollments: bigint;
  average_progress: Prisma.Decimal | null;
}

interface SummaryRow {
  active_learners: bigint;
  lesson_opens: bigint;
  lesson_completions: bigint;
  active_seconds: bigint;
}

interface DailyRow {
  day: Date;
  lesson_opens: bigint;
  lesson_completions: bigint;
  active_learners: bigint;
}

@Injectable()
export class DashboardAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [summaryRows, courseRows, dailyRows] = await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        SELECT
          COUNT(DISTINCT "user_id")::bigint AS active_learners,
          COUNT(*) FILTER (WHERE "event_name" = 'learning.lesson_opened')::bigint AS lesson_opens,
          COUNT(*) FILTER (WHERE "event_name" = 'learning.lesson_completed')::bigint AS lesson_completions,
          COALESCE(SUM("duration_seconds"), 0)::bigint AS active_seconds
        FROM "learning_events"
        WHERE "occurred_at" >= ${since}
      `),
      this.prisma.$queryRaw<CourseRow[]>(Prisma.sql`
        WITH event_stats AS (
          SELECT
            "course_id",
            COUNT(*) FILTER (WHERE "event_name" = 'learning.lesson_opened')::bigint AS lesson_opens,
            COUNT(*) FILTER (WHERE "event_name" = 'learning.lesson_completed')::bigint AS lesson_completions,
            COUNT(DISTINCT "user_id")::bigint AS active_learners
          FROM "learning_events"
          WHERE "occurred_at" >= ${since} AND "course_id" IS NOT NULL
          GROUP BY "course_id"
        ),
        enrollment_stats AS (
          SELECT
            e."course_id",
            COUNT(e."id")::bigint AS enrollment_count,
            COUNT(e."id") FILTER (WHERE e."status" = 'COMPLETED')::bigint AS completed_enrollments,
            COALESCE(AVG(cp."progress_percent"), 0) AS average_progress
          FROM "enrollments" e
          LEFT JOIN "course_progress" cp ON cp."enrollment_id" = e."id"
          GROUP BY e."course_id"
        )
        SELECT
          c."id",
          c."title",
          c."thumbnail_url",
          COALESCE(es.lesson_opens, 0)::bigint AS lesson_opens,
          COALESCE(es.lesson_completions, 0)::bigint AS lesson_completions,
          COALESCE(es.active_learners, 0)::bigint AS active_learners,
          COALESCE(ns.enrollment_count, 0)::bigint AS enrollment_count,
          COALESCE(ns.completed_enrollments, 0)::bigint AS completed_enrollments,
          COALESCE(ns.average_progress, 0) AS average_progress
        FROM "courses" c
        LEFT JOIN event_stats es ON es."course_id" = c."id"
        LEFT JOIN enrollment_stats ns ON ns."course_id" = c."id"
        ORDER BY (COALESCE(es.lesson_opens, 0) + COALESCE(es.lesson_completions, 0)) DESC, c."title" ASC
        LIMIT 10
      `),
      this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT
          DATE_TRUNC('day', "occurred_at") AS day,
          COUNT(*) FILTER (WHERE "event_name" = 'learning.lesson_opened')::bigint AS lesson_opens,
          COUNT(*) FILTER (WHERE "event_name" = 'learning.lesson_completed')::bigint AS lesson_completions,
          COUNT(DISTINCT "user_id")::bigint AS active_learners
        FROM "learning_events"
        WHERE "occurred_at" >= ${since}
        GROUP BY DATE_TRUNC('day', "occurred_at")
        ORDER BY day ASC
      `),
    ]);

    const summary = summaryRows[0];
    return {
      periodDays: days,
      summary: {
        activeLearners: Number(summary?.active_learners ?? 0),
        lessonOpens: Number(summary?.lesson_opens ?? 0),
        lessonCompletions: Number(summary?.lesson_completions ?? 0),
        learningMinutes: Math.round(Number(summary?.active_seconds ?? 0) / 60),
      },
      courses: courseRows.map((row) => {
        const enrollmentCount = Number(row.enrollment_count);
        const completedEnrollments = Number(row.completed_enrollments);
        return {
          courseId: row.id,
          title: row.title,
          thumbnailUrl: row.thumbnail_url,
          lessonOpens: Number(row.lesson_opens),
          lessonCompletions: Number(row.lesson_completions),
          activeLearners: Number(row.active_learners),
          enrollmentCount,
          averageProgress: Number(row.average_progress ?? 0),
          completionRate: enrollmentCount > 0
            ? Math.round((completedEnrollments / enrollmentCount) * 1000) / 10
            : 0,
        };
      }),
      daily: dailyRows.map((row) => ({
        date: row.day,
        lessonOpens: Number(row.lesson_opens),
        lessonCompletions: Number(row.lesson_completions),
        activeLearners: Number(row.active_learners),
      })),
    };
  }
}
