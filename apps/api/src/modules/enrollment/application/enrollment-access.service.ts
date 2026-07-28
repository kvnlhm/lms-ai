import { Injectable } from '@nestjs/common';
import { EnrollmentStatus, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

export interface CourseAccess {
  enrollmentId: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
}

/**
 * Satu-satunya tempat aturan "boleh membuka kursus ini" ditegakkan.
 *
 * Modul delivery dan progress memanggil service ini, bukan membaca tabel
 * enrollment secara langsung (Architecture bagian 9.3). Dengan begitu aturan
 * akses tidak bercabang di banyak tempat.
 */
@Injectable()
export class EnrollmentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertActiveAccess(userId: string, courseId: string): Promise<CourseAccess> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { course: { select: { status: true } } },
    });

    // Tanpa enrollment, keberadaan kursus tidak boleh dapat disimpulkan.
    if (!enrollment) throw AppError.notFound();
    if (enrollment.course.status !== PublicationStatus.PUBLISHED) throw AppError.courseNotPublished();

    if (
      enrollment.status === EnrollmentStatus.REMOVED ||
      enrollment.status === EnrollmentStatus.EXPIRED
    ) {
      throw AppError.enrollmentInactive();
    }

    const now = new Date();
    if (enrollment.accessStartsAt && enrollment.accessStartsAt > now) {
      throw AppError.enrollmentInactive();
    }
    if (enrollment.accessEndsAt && enrollment.accessEndsAt <= now) {
      throw AppError.enrollmentInactive();
    }

    return {
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: enrollment.status,
    };
  }

  /** Varian untuk lesson: memetakan lesson ke course lalu memvalidasi akses. */
  async assertLessonAccess(
    userId: string,
    lessonId: string,
  ): Promise<CourseAccess & { lessonId: string }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        isActive: true,
        module: { select: { isActive: true, courseId: true } },
      },
    });

    if (!lesson || !lesson.isActive || !lesson.module.isActive) throw AppError.notFound();

    const access = await this.assertActiveAccess(userId, lesson.module.courseId);
    return { ...access, lessonId: lesson.id };
  }
}
