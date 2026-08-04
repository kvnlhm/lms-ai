import { Injectable } from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { EnrollmentAccessService } from './enrollment-access.service';

export interface MyEnrollmentItem {
  enrollmentId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  course: {
    id: string;
    slug: string;
    title: string;
    thumbnailUrl: string | null;
    shortDescription: string | null;
    level: string;
    estimatedMinutes: number;
    category: string | null;
  };
  progress: {
    percent: number;
    requiredLessonsTotal: number;
    requiredLessonsCompleted: number;
    lastLessonId: string | null;
    lastActivityAt: Date | null;
  };
}

@Injectable()
export class MyEnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
  ) {}

  async list(userId: string): Promise<MyEnrollmentItem[]> {
    await this.access.ensureAllPublishedCourseAccess(userId);
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        course: { status: 'PUBLISHED' },
      },
      include: {
        course: { include: { category: { select: { name: true } } } },
        courseProgress: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      course: {
        id: enrollment.course.id,
        slug: enrollment.course.slug,
        title: enrollment.course.title,
        thumbnailUrl: enrollment.course.thumbnailUrl,
        shortDescription: enrollment.course.shortDescription,
        level: enrollment.course.level,
        estimatedMinutes: enrollment.course.estimatedMinutes,
        category: enrollment.course.category?.name ?? null,
      },
      progress: {
        percent: Number(enrollment.courseProgress?.progressPercent ?? 0),
        requiredLessonsTotal: enrollment.courseProgress?.requiredLessonsTotal ?? 0,
        requiredLessonsCompleted: enrollment.courseProgress?.requiredLessonsComplete ?? 0,
        lastLessonId: enrollment.courseProgress?.lastLessonId ?? null,
        lastActivityAt: enrollment.courseProgress?.lastActivityAt ?? null,
      },
    }));
  }
}
