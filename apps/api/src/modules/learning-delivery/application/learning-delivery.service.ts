import { Injectable } from '@nestjs/common';
import { LessonProgressStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';
import { flattenLessons, neighbours, nextIncomplete } from './lesson-navigation';
import { ambangPelajaran } from '../../learning-progress/application/completion-rule';

@Injectable()
export class LearningDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
  ) {}

  /** Kurikulum lengkap beserta status tiap pelajaran untuk pengguna ini. */
  async course(userId: string, courseId: string) {
    const access = await this.access.assertActiveAccess(userId, courseId);

    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: {
        modules: {
          where: { isActive: true },
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              where: { isActive: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    // Akun gratis tidak punya wadah progres, jadi tidak ada yang perlu dibaca.
    // Dua kueri ini dilewati, bukan dijalankan dengan penyaring yang sudah
    // pasti tidak menemukan apa pun.
    const progressRows = access.enrollmentId
      ? await this.prisma.lessonProgress.findMany({
          where: { enrollmentId: access.enrollmentId },
          select: { lessonId: true, status: true, completedAt: true },
        })
      : [];
    const statusByLesson = new Map(progressRows.map((row) => [row.lessonId, row]));
    const completed = new Set(
      progressRows.filter((row) => row.status === LessonProgressStatus.COMPLETED).map((row) => row.lessonId),
    );

    const courseProgress = access.enrollmentId
      ? await this.prisma.courseProgress.findUnique({
          where: { enrollmentId: access.enrollmentId },
        })
      : null;

    const ordered = flattenLessons(course.modules);

    return {
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        shortDescription: course.shortDescription,
        estimatedMinutes: course.estimatedMinutes,
        preview: access.preview,
        entitled: access.berhakIsi,
      },
      modules: course.modules.map((module) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        position: module.position,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          position: lesson.position,
          contentType: lesson.contentType,
          estimatedMinutes: lesson.estimatedMinutes,
          isRequired: lesson.isRequired,
          status: statusByLesson.get(lesson.id)?.status ?? LessonProgressStatus.NOT_STARTED,
          completedAt: statusByLesson.get(lesson.id)?.completedAt ?? null,
          // Dihitung di server, bukan disimpulkan klien dari `entitled` dan
          // sebuah kolom `isPreview` yang tidak pernah dikirim ke sini.
          locked: !access.berhakIsi && !lesson.isPreview,
        })),
      })),
      progress: {
        percent: Number(courseProgress?.progressPercent ?? 0),
        requiredLessonsTotal: courseProgress?.requiredLessonsTotal ?? 0,
        requiredLessonsCompleted: courseProgress?.requiredLessonsComplete ?? 0,
        lastActivityAt: courseProgress?.lastActivityAt ?? null,
        completedAt: courseProgress?.completedAt ?? null,
      },
      lastLessonId: courseProgress?.lastLessonId ?? null,
      nextLessonId: nextIncomplete(ordered, completed),
      totalLessons: ordered.length,
    };
  }

  /** Isi satu pelajaran. Prasyarat diperiksa di sini, bukan di klien. */
  async lesson(userId: string, lessonId: string) {
    const access = await this.access.assertLessonAccess(userId, lessonId);

    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: {
        prerequisites: { select: { prerequisiteLessonId: true } },
        module: { select: { id: true, courseId: true, title: true } },
        material: { select: { id: true } },
      },
    });

    const progressRows = access.enrollmentId
      ? await this.prisma.lessonProgress.findMany({
          where: { enrollmentId: access.enrollmentId },
          select: { lessonId: true, status: true },
        })
      : [];
    const completed = new Set(
      progressRows.filter((row) => row.status === LessonProgressStatus.COMPLETED).map((row) => row.lessonId),
    );

    const ambang = ambangPelajaran(lesson.completionRule, lesson.completionConfig);

    const unmet = lesson.prerequisites.filter((row) => !completed.has(row.prerequisiteLessonId));
    if (unmet.length > 0) {
      throw AppError.lessonLocked('Selesaikan pelajaran prasyarat terlebih dahulu.');
    }

    const modules = await this.prisma.courseModule.findMany({
      where: { courseId: lesson.module.courseId, isActive: true },
      orderBy: { position: 'asc' },
      include: { lessons: { where: { isActive: true }, orderBy: { position: 'asc' } } },
    });
    const ordered = flattenLessons(modules);
    const { previousLessonId, nextLessonId } = neighbours(ordered, lessonId);

    const [courseProgress, bookmarked] = await Promise.all([
      access.enrollmentId
        ? this.prisma.courseProgress.findUnique({
            where: { enrollmentId: access.enrollmentId },
            select: { progressPercent: true },
          })
        : null,
      this.prisma.userBookmark.count({ where: { userId, lessonId } }),
    ]);

    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      contentType: lesson.contentType,
      // Sumber media untuk VIDEO dan PDF akan berupa URL bertanda tangan yang
      // dibuat modul media setelah otorisasi; belum ada di walking skeleton.
      content: {
        text: lesson.textContent,
        externalUrl: lesson.externalUrl,
        streamUrl: null as string | null,
      },
      // Hanya keberadaannya yang disebut, bukan kuncinya: mengetahui nama
      // berkas tidak boleh pernah menjadi jalan pintas menuju isinya.
      hasMaterial: lesson.material !== null,
      moduleId: lesson.module.id,
      moduleTitle: lesson.module.title,
      courseId: lesson.module.courseId,
      isRequired: lesson.isRequired,
      completionRule: lesson.completionRule,
      // Ambangnya ikut dikirim supaya pelajar melihat targetnya sebelum
      // mencoba, bukan menemukan penolakan setelah menekan tombol.
      completionVideoPercentage: ambang.videoPercentage,
      completionMinimumSeconds: ambang.minimumActiveSeconds,
      status: progressRows.find((row) => row.lessonId === lessonId)?.status ?? LessonProgressStatus.NOT_STARTED,
      previousLessonId,
      nextLessonId,
      courseProgress: Number(courseProgress?.progressPercent ?? 0),
      // Ikut di sini, bukan lewat permintaan terpisah, supaya tombolnya tidak
      // sempat tampil dalam keadaan salah lalu berkedip saat datanya tiba.
      bookmarked: bookmarked > 0,
    };
  }
}
