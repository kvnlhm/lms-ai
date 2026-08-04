import { Inject, Injectable } from '@nestjs/common';
import { EnrollmentStatus, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { COURSE_PREVIEW_ACCESS, type CoursePreviewAccessPort } from './course-preview.port';

export interface CourseAccess {
  enrollmentId: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  /**
   * Benar bila kursus dibuka lewat hak pratinjau, bukan karena sudah terbit.
   * Dipakai antarmuka untuk menyatakan bahwa yang terlihat belum tayang bagi
   * pelajar; tanpa itu draf dan kursus terbit tampak persis sama.
   */
  preview: boolean;
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(COURSE_PREVIEW_ACCESS) private readonly pratinjau: CoursePreviewAccessPort,
  ) {}

  async assertActiveAccess(userId: string, courseId: string): Promise<CourseAccess> {
    const enrollment = await this.ensureCourseAccess(userId, courseId);

    return {
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: enrollment.status,
      preview: enrollment.preview,
    };
  }

  /**
   * Enrollment hanya menjadi wadah progres. Semua pengguna terautentikasi
   * otomatis memperoleh akses permanen ke setiap kursus yang sudah terbit.
   *
   * Di luar itu ada satu jalan masuk: penyusun kursus boleh membuka kursus yang
   * belum terbit sebagai pratinjau. Tanpa itu, satu-satunya cara memeriksa hasil
   * penyusunan adalah menerbitkannya lebih dulu kepada seluruh pelajar — dan
   * tombol "Pratinjau sebagai pelajar" di editor selama ini hanya menghasilkan
   * 404. Pratinjau memakai jalur yang sama persis dengan pelajar, karena
   * pemeriksaan yang menempuh jalur berbeda tidak membuktikan apa-apa.
   */
  async ensureCourseAccess(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        status: true,
        modules: {
          where: { isActive: true },
          select: { lessons: { where: { isActive: true, isRequired: true }, select: { id: true } } },
        },
      },
    });
    if (!course) throw AppError.notFound();

    // Kursus terbit adalah jalur cepat: tidak ada pertanyaan tambahan ke modul
    // identity, sehingga permintaan pelajar tidak menanggung biaya apa pun.
    const preview = course.status !== PublicationStatus.PUBLISHED;
    if (preview && !(await this.pratinjau.bolehPratinjauKursus(userId))) {
      // Sengaja 404, bukan 403: keberadaan kursus yang belum terbit bukan
      // sesuatu yang perlu dikonfirmasi kepada yang tidak berhak melihatnya.
      throw AppError.notFound();
    }

    const requiredLessonsTotal = course.modules.reduce(
      (total, module) => total + module.lessons.length,
      0,
    );

    const enrollment = await this.prisma.$transaction(async (tx) => {
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

    return { ...enrollment, preview };
  }

  async ensureAllPublishedCourseAccess(userId: string): Promise<void> {
    const courses = await this.prisma.course.findMany({
      where: { status: PublicationStatus.PUBLISHED },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const course of courses) {
      await this.ensureCourseAccess(userId, course.id);
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
