import { Injectable } from '@nestjs/common';
import { EnrollmentStatus, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

const EVENT_NAMES = ['learning.lesson_opened', 'learning.lesson_completed'] as const;

@Injectable()
export class LearningHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async continueLearning(userId: string) {
    const now = new Date();
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: EnrollmentStatus.ACTIVE,
        course: { status: PublicationStatus.PUBLISHED },
        AND: [
          { OR: [{ accessStartsAt: null }, { accessStartsAt: { lte: now } }] },
          { OR: [{ accessEndsAt: null }, { accessEndsAt: { gt: now } }] },
        ],
      },
      include: {
        course: {
          include: {
            modules: {
              where: { isActive: true },
              orderBy: { position: 'asc' },
              include: {
                lessons: {
                  where: { isActive: true },
                  orderBy: { position: 'asc' },
                  select: { id: true, title: true, contentType: true },
                },
              },
            },
          },
        },
        courseProgress: { include: { lastLesson: { include: { module: true } } } },
        lessonProgress: { select: { lessonId: true, status: true } },
      },
      orderBy: [{ courseProgress: { lastActivityAt: 'desc' } }, { enrolledAt: 'desc' }],
    });

    const enrollment = enrollments[0];
    if (!enrollment) return null;
    const completed = new Set(
      enrollment.lessonProgress
        .filter((item) => item.status === 'COMPLETED')
        .map((item) => item.lessonId),
    );
    const firstIncomplete = enrollment.course.modules
      .flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, module })))
      .find((lesson) => !completed.has(lesson.id));
    const last = enrollment.courseProgress?.lastLesson;
    const lesson = last && !completed.has(last.id)
      ? { id: last.id, title: last.title, contentType: last.contentType, module: last.module }
      : firstIncomplete;

    return {
      enrollmentId: enrollment.id,
      course: {
        id: enrollment.course.id,
        title: enrollment.course.title,
        shortDescription: enrollment.course.shortDescription,
      },
      lesson: lesson
        ? { id: lesson.id, title: lesson.title, contentType: lesson.contentType, moduleTitle: lesson.module.title }
        : null,
      progressPercent: Number(enrollment.courseProgress?.progressPercent ?? 0),
      lastActivityAt: enrollment.courseProgress?.lastActivityAt ?? null,
    };
  }

  async history(userId: string, cursor: string | undefined, limit: number) {
    let cursorId: bigint | undefined;
    if (cursor !== undefined) {
      try {
        cursorId = BigInt(cursor);
      } catch {
        throw AppError.validation({ cursor: ['Cursor tidak valid.'] });
      }
      if (cursorId < 1n) throw AppError.validation({ cursor: ['Cursor tidak valid.'] });
    }

    const events = await this.prisma.learningEvent.findMany({
      where: {
        userId,
        eventName: { in: [...EVENT_NAMES] },
        ...(cursorId ? { id: { lt: cursorId } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const hasMore = events.length > limit;
    const page = events.slice(0, limit);
    const courseIds = [...new Set(page.flatMap((event) => event.courseId ? [event.courseId] : []))];
    const lessonIds = [...new Set(page.flatMap((event) => event.lessonId ? [event.lessonId] : []))];
    const [courses, lessons] = await Promise.all([
      this.prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } }),
      this.prisma.lesson.findMany({
        where: { id: { in: lessonIds } },
        select: { id: true, title: true, module: { select: { title: true } } },
      }),
    ]);
    const courseMap = new Map(courses.map((course) => [course.id, course.title]));
    const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));

    return {
      items: page.map((event) => {
        const lesson = event.lessonId ? lessonMap.get(event.lessonId) : undefined;
        const metadata = asRecord(event.metadata);
        return {
          id: event.id.toString(),
          activityType: event.eventName === 'learning.lesson_completed' ? 'LESSON_COMPLETED' : 'LESSON_OPENED',
          occurredAt: event.occurredAt,
          durationSeconds: event.durationSeconds,
          courseId: event.courseId,
          courseTitle: event.courseId ? courseMap.get(event.courseId) ?? 'Kursus tidak tersedia' : 'Kursus tidak tersedia',
          lessonId: event.lessonId,
          lessonTitle: lesson?.title ?? 'Pelajaran tidak tersedia',
          moduleTitle: lesson?.module.title ?? null,
          progressAfter: numberOrNull(metadata.courseProgressPercent),
        };
      }),
      nextCursor: hasMore ? page.at(-1)?.id.toString() ?? null : null,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
