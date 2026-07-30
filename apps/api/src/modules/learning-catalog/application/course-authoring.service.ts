import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import {
  LESSON_VIDEO_CLEANUP,
  type LessonVideoCleanupPort,
} from './lesson-video-cleanup.port';
import { checkPublishable } from './publication-rules';
import { CourseThumbnailService } from './course-thumbnail.service';

export interface CreateCourseInput {
  title: string;
  slug: string;
  categoryId?: string;
  shortDescription?: string;
  description?: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedMinutes?: number;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface ModuleInput {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  isActive?: boolean;
}

export interface LessonInput {
  title: string;
  description?: string;
  contentType: 'VIDEO' | 'TEXT' | 'PDF' | 'EXTERNAL_LINK';
  textContent?: string;
  externalUrl?: string;
  estimatedMinutes?: number;
  isRequired?: boolean;
  isPreview?: boolean;
  isActive?: boolean;
  completionRule?: 'MANUAL' | 'OPENED' | 'MINIMUM_ACTIVE_SECONDS' | 'VIDEO_PERCENTAGE';
}

/**
 * Pemetaan dari baris Prisma ke bentuk respons.
 *
 * Entity persistence tidak dikembalikan apa adanya (ADR-011): kolom internal
 * seperti `createdBy` dan `createdAt` tidak perlu diketahui klien, dan bentuk
 * respons harus stabil meskipun skema berubah.
 */
function toCourse(row: {
  id: string; slug: string; title: string;
  thumbnailUrl: string | null;
  shortDescription: string | null; description: string | null;
  level: string; status: string; estimatedMinutes: number;
  categoryId: string | null; publishedAt: Date | null; archivedAt: Date | null; updatedAt: Date;
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    shortDescription: row.shortDescription,
    description: row.description,
    level: row.level,
    status: row.status,
    estimatedMinutes: row.estimatedMinutes,
    categoryId: row.categoryId,
    publishedAt: row.publishedAt,
    archivedAt: row.archivedAt,
    updatedAt: row.updatedAt,
  };
}

function toModule(row: {
  id: string; courseId: string; title: string; description: string | null;
  position: number; estimatedMinutes: number; isActive: boolean;
}) {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    position: row.position,
    estimatedMinutes: row.estimatedMinutes,
    isActive: row.isActive,
  };
}

function toLesson(row: {
  id: string; moduleId: string; title: string; description: string | null;
  contentType: string; textContent: string | null; externalUrl: string | null;
  position: number; estimatedMinutes: number;
  isRequired: boolean; isPreview: boolean; isActive: boolean; completionRule: string;
}) {
  return {
    id: row.id,
    moduleId: row.moduleId,
    title: row.title,
    description: row.description,
    contentType: row.contentType,
    textContent: row.textContent,
    externalUrl: row.externalUrl,
    position: row.position,
    estimatedMinutes: row.estimatedMinutes,
    isRequired: row.isRequired,
    isPreview: row.isPreview,
    isActive: row.isActive,
    completionRule: row.completionRule,
  };
}

@Injectable()
export class CourseAuthoringService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LESSON_VIDEO_CLEANUP) private readonly videos: LessonVideoCleanupPort,
    private readonly thumbnails: CourseThumbnailService,
  ) {}

  // ── Kursus ──────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.courseCategory.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Daftar untuk Master; mencakup draf dan arsip, tidak seperti katalog publik. */
  async list(params: { page: number; pageSize: number; status?: PublicationStatus; search?: string }) {
    const where: Prisma.CourseWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { title: { contains: params.search, mode: 'insensitive' } } : {}),
    };

    const [total, courses] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { modules: true, enrollments: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    const items = await Promise.all(
      courses.map(async (course) => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        thumbnailUrl: course.thumbnailUrl,
        shortDescription: course.shortDescription,
        level: course.level,
        status: course.status,
        estimatedMinutes: course.estimatedMinutes,
        category: course.category
          ? { id: course.category.id, name: course.category.name, slug: course.category.slug }
          : null,
        moduleCount: course._count.modules,
        enrollmentCount: course._count.enrollments,
        lessonCount: await this.prisma.lesson.count({ where: { module: { courseId: course.id } } }),
        publishedAt: course.publishedAt,
        updatedAt: course.updatedAt,
      })),
    );

    return { items, total };
  }

  async create(input: CreateCourseInput, actorId: string) {
    await this.assertSlugAvailable(input.slug);

    return toCourse(await this.prisma.course.create({
      data: {
        title: input.title,
        slug: input.slug,
        categoryId: input.categoryId ?? null,
        shortDescription: input.shortDescription ?? null,
        description: input.description ?? null,
        level: input.level,
        estimatedMinutes: input.estimatedMinutes ?? 0,
        createdBy: actorId,
        // Kursus baru selalu draf. Penerbitan adalah tindakan terpisah yang
        // punya aturan kelayakannya sendiri.
        status: PublicationStatus.DRAFT,
      },
    }));
  }

  async update(courseId: string, input: UpdateCourseInput) {
    const course = await this.findOrFail(courseId);
    if (input.slug && input.slug !== course.slug) await this.assertSlugAvailable(input.slug);

    return toCourse(
      await this.prisma.course.update({
        where: { id: courseId },
        data: {
          title: input.title,
          slug: input.slug,
          categoryId: input.categoryId,
          shortDescription: input.shortDescription,
          description: input.description,
          level: input.level,
          estimatedMinutes: input.estimatedMinutes,
        },
      }),
    );
  }

  async publish(courseId: string) {
    await this.findOrFail(courseId);

    const [activeModuleCount, activeLessonCount, requiredLessonCount] = await Promise.all([
      this.prisma.courseModule.count({ where: { courseId, isActive: true } }),
      this.prisma.lesson.count({
        where: { isActive: true, module: { courseId, isActive: true } },
      }),
      this.prisma.lesson.count({
        where: { isActive: true, isRequired: true, module: { courseId, isActive: true } },
      }),
    ]);

    const verdict = checkPublishable({ activeModuleCount, activeLessonCount, requiredLessonCount });
    if (!verdict.publishable) {
      throw AppError.validation({ course: verdict.reasons });
    }

    return toCourse(
      await this.prisma.course.update({
        where: { id: courseId },
        data: { status: PublicationStatus.PUBLISHED, publishedAt: new Date(), archivedAt: null },
      }),
    );
  }

  async archive(courseId: string) {
    await this.findOrFail(courseId);
    return toCourse(
      await this.prisma.course.update({
        where: { id: courseId },
        data: { status: PublicationStatus.ARCHIVED, archivedAt: new Date() },
      }),
    );
  }

  /**
   * Penghapusan permanen hanya untuk kursus yang belum pernah dipakai.
   * Selain itu gunakan arsip, supaya riwayat belajar tidak ikut hilang.
   */
  async remove(courseId: string) {
    await this.findOrFail(courseId);

    const enrollments = await this.prisma.enrollment.count({ where: { courseId } });
    if (enrollments > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        409,
        'Kursus sudah memiliki enrollment. Gunakan arsip agar riwayat belajar tetap utuh.',
      );
    }

    const lessons = await this.prisma.lesson.findMany({
      where: { module: { courseId } },
      select: { id: true },
    });
    await this.videos.removeForLessons(lessons.map(({ id }) => id));
    const deleted = await this.prisma.course.delete({
      where: { id: courseId },
      select: { thumbnailUrl: true },
    });
    await this.thumbnails.removeByUrl(deleted.thumbnailUrl).catch(() => undefined);
  }

  async detail(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        modules: {
          orderBy: { position: 'asc' },
          include: { lessons: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!course) throw AppError.notFound();

    return {
      ...toCourse(course),
      category: course.category
        ? { id: course.category.id, name: course.category.name, slug: course.category.slug }
        : null,
      modules: course.modules.map((row) => ({
        ...toModule(row),
        lessons: row.lessons.map(toLesson),
      })),
    };
  }

  // ── Bagian (module) ─────────────────────────────────────────

  async addModule(courseId: string, input: ModuleInput) {
    await this.findOrFail(courseId);
    // Posisi ditentukan server, bukan klien, supaya tidak pernah bentrok
    // dengan unique constraint (courseId, position).
    const last = await this.prisma.courseModule.findFirst({
      where: { courseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return toModule(await this.prisma.courseModule.create({
      data: {
        courseId,
        title: input.title,
        description: input.description ?? null,
        estimatedMinutes: input.estimatedMinutes ?? 0,
        isActive: input.isActive ?? true,
        position: (last?.position ?? 0) + 1,
      },
    }));
  }

  async updateModule(moduleId: string, input: Partial<ModuleInput>) {
    await this.findModuleOrFail(moduleId);
    return toModule(
      await this.prisma.courseModule.update({
        where: { id: moduleId },
        data: {
          title: input.title,
          description: input.description,
          estimatedMinutes: input.estimatedMinutes,
          isActive: input.isActive,
        },
      }),
    );
  }

  async removeModule(moduleId: string) {
    const courseModule = await this.findModuleOrFail(moduleId);

    const progress = await this.prisma.lessonProgress.count({
      where: { lesson: { moduleId } },
    });
    if (progress > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        409,
        'Bagian ini sudah memiliki riwayat belajar. Nonaktifkan alih-alih menghapus.',
      );
    }

    const lessons = await this.prisma.lesson.findMany({
      where: { moduleId },
      select: { id: true },
    });
    await this.videos.removeForLessons(lessons.map(({ id }) => id));
    await this.prisma.courseModule.delete({ where: { id: moduleId } });
    await this.compactModulePositions(courseModule.courseId);
  }

  async reorderModules(courseId: string, moduleIds: string[]) {
    const existing = await this.prisma.courseModule.findMany({
      where: { courseId },
      select: { id: true },
    });

    assertSamePermutation(
      existing.map((row) => row.id),
      moduleIds,
      'moduleIds harus memuat tepat seluruh bagian pada kursus ini.',
    );

    // Dua fase: geser ke posisi negatif dulu supaya tidak menabrak unique
    // constraint di tengah proses penukaran.
    await this.prisma.$transaction(async (tx) => {
      for (const [index, id] of moduleIds.entries()) {
        await tx.courseModule.update({ where: { id }, data: { position: -(index + 1) } });
      }
      for (const [index, id] of moduleIds.entries()) {
        await tx.courseModule.update({ where: { id }, data: { position: index + 1 } });
      }
    });
  }

  // ── Pelajaran ───────────────────────────────────────────────

  async addLesson(moduleId: string, input: LessonInput) {
    await this.findModuleOrFail(moduleId);
    const last = await this.prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return toLesson(await this.prisma.lesson.create({
      data: {
        moduleId,
        title: input.title,
        description: input.description ?? null,
        contentType: input.contentType,
        textContent: input.textContent ?? null,
        externalUrl: input.externalUrl ?? null,
        estimatedMinutes: input.estimatedMinutes ?? 0,
        isRequired: input.isRequired ?? true,
        isPreview: input.isPreview ?? false,
        isActive: input.isActive ?? true,
        completionRule: input.completionRule ?? 'MANUAL',
        position: (last?.position ?? 0) + 1,
      },
    }));
  }

  async updateLesson(lessonId: string, input: Partial<LessonInput>) {
    await this.findLessonOrFail(lessonId);
    return toLesson(await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: input.title,
        description: input.description,
        contentType: input.contentType,
        textContent: input.textContent,
        externalUrl: input.externalUrl,
        estimatedMinutes: input.estimatedMinutes,
        isRequired: input.isRequired,
        isPreview: input.isPreview,
        isActive: input.isActive,
        completionRule: input.completionRule,
      },
    }));
  }

  async removeLesson(lessonId: string) {
    const lesson = await this.findLessonOrFail(lessonId);

    const progress = await this.prisma.lessonProgress.count({ where: { lessonId } });
    if (progress > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        409,
        'Pelajaran ini sudah memiliki riwayat belajar. Nonaktifkan alih-alih menghapus.',
      );
    }

    await this.videos.removeForLessons([lessonId]);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    await this.compactLessonPositions(lesson.moduleId);
  }

  async reorderLessons(moduleId: string, lessonIds: string[]) {
    const existing = await this.prisma.lesson.findMany({
      where: { moduleId },
      select: { id: true },
    });

    assertSamePermutation(
      existing.map((row) => row.id),
      lessonIds,
      'lessonIds harus memuat tepat seluruh pelajaran pada bagian ini.',
    );

    await this.prisma.$transaction(async (tx) => {
      for (const [index, id] of lessonIds.entries()) {
        await tx.lesson.update({ where: { id }, data: { position: -(index + 1) } });
      }
      for (const [index, id] of lessonIds.entries()) {
        await tx.lesson.update({ where: { id }, data: { position: index + 1 } });
      }
    });
  }

  // ── Pembantu ────────────────────────────────────────────────

  private async findOrFail(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw AppError.notFound();
    return course;
  }

  private async findModuleOrFail(moduleId: string) {
    const courseModule = await this.prisma.courseModule.findUnique({ where: { id: moduleId } });
    if (!courseModule) throw AppError.notFound();
    return courseModule;
  }

  private async findLessonOrFail(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw AppError.notFound();
    return lesson;
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    const existing = await this.prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      throw AppError.validation({ slug: ['Slug sudah dipakai kursus lain.'] });
    }
  }

  /** Menutup lubang posisi setelah penghapusan agar urutannya tetap 1..n. */
  private async compactModulePositions(courseId: string): Promise<void> {
    const rows = await this.prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await this.reorderModulesUnchecked(rows.map((row) => row.id));
  }

  private async compactLessonPositions(moduleId: string): Promise<void> {
    const rows = await this.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const ids = rows.map((row) => row.id);
    await this.prisma.$transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx.lesson.update({ where: { id }, data: { position: -(index + 1) } });
      }
      for (const [index, id] of ids.entries()) {
        await tx.lesson.update({ where: { id }, data: { position: index + 1 } });
      }
    });
  }

  private async reorderModulesUnchecked(moduleIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const [index, id] of moduleIds.entries()) {
        await tx.courseModule.update({ where: { id }, data: { position: -(index + 1) } });
      }
      for (const [index, id] of moduleIds.entries()) {
        await tx.courseModule.update({ where: { id }, data: { position: index + 1 } });
      }
    });
  }
}

/**
 * Memastikan daftar urutan baru memuat tepat elemen yang sama.
 *
 * Tanpa pemeriksaan ini, klien dapat menghilangkan atau menyisipkan ID dan
 * meninggalkan urutan yang berlubang.
 */
function assertSamePermutation(existing: string[], incoming: string[], message: string): void {
  const a = [...existing].sort();
  const b = [...new Set(incoming)].sort();
  const same = a.length === b.length && a.every((id, index) => id === b[index]);
  if (!same) throw AppError.validation({ order: [message] });
}
