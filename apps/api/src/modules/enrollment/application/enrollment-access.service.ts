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
    const enrollment = await this.ensurePublishedCourseAccess(userId, courseId);

    return {
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: enrollment.status,
    };
  }

  /**
   * Enrollment hanya menjadi wadah progres. Semua pengguna terautentikasi
   * otomatis memperoleh akses permanen ke setiap kursus yang sudah terbit.
   */
  async ensurePublishedCourseAccess(userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: PublicationStatus.PUBLISHED },
      select: {
        id: true,
        modules: {
          where: { isActive: true },
          select: { lessons: { where: { isActive: true, isRequired: true }, select: { id: true } } },
        },
      },
    });
    if (!course) throw AppError.notFound();
    const requiredLessonsTotal = course.modules.reduce(
      (total, module) => total + module.lessons.length,
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true, status: true },
      });
      const enrollment = existing
        ? await tx.enrollment.update({
            where: { id: existing.id },
            data: {
              ...(existing.status === EnrollmentStatus.COMPLETED
                ? {}
                : { status: EnrollmentStatus.ACTIVE }),
              accessStartsAt: null,
              accessEndsAt: null,
              removedAt: null,
            },
          })
        : await tx.enrollment.create({
            data: { userId, courseId, status: EnrollmentStatus.ACTIVE },
          });
      await tx.courseProgress.upsert({
        where: { enrollmentId: enrollment.id },
        create: { enrollmentId: enrollment.id, requiredLessonsTotal },
        update: { requiredLessonsTotal },
      });
      return enrollment;
    });
  }

  async ensureAllPublishedCourseAccess(userId: string): Promise<void> {
    const courses = await this.prisma.course.findMany({
      where: { status: PublicationStatus.PUBLISHED },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const course of courses) {
      await this.ensurePublishedCourseAccess(userId, course.id);
    }
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
