import { Injectable } from '@nestjs/common';
import { EnrollmentStatus, type Prisma, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';

export interface CatalogQuery {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  level?: string;
}

@Injectable()
export class CourseCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
  ) {}

  /**
   * Katalog publik hanya berisi kursus PUBLISHED. Kursus DRAFT dan ARCHIVED
   * tidak pernah muncul di sini, termasuk untuk Master — pengelolaan memakai
   * endpoint /admin terpisah.
   */
  /**
   * Kategori yang dapat dipakai menyaring katalog.
   *
   * Dihitung dari kursus terbit, bukan dari seluruh daftar kategori: kategori
   * yang isinya masih draf akan muncul sebagai pilihan yang selalu kosong.
   */
  async categories(): Promise<Array<{ name: string; slug: string; courseCount: number }>> {
    const rows = await this.prisma.courseCategory.findMany({
      where: { courses: { some: { status: PublicationStatus.PUBLISHED } } },
      select: {
        name: true,
        slug: true,
        _count: { select: { courses: { where: { status: PublicationStatus.PUBLISHED } } } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      name: row.name,
      slug: row.slug,
      courseCount: row._count.courses,
    }));
  }

  async list(
    query: CatalogQuery,
    userId: string,
  ): Promise<{ items: unknown[]; total: number }> {
    await this.access.ensureAllPublishedCourseAccess(userId);
    const where: Prisma.CourseWhereInput = {
      status: PublicationStatus.PUBLISHED,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { shortDescription: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.level ? { level: query.level as Prisma.EnumCourseLevelFilter['equals'] } : {}),
    };

    const [total, courses] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        include: {
          category: { select: { name: true, slug: true } },
          enrollments: {
            where: { userId },
            select: { id: true, status: true, courseProgress: { select: { progressPercent: true } } },
          },
          _count: { select: { modules: true } },
        },
        // Urutan yang ditentukan Master lebih dulu; tanggal terbit dan abjad
        // tinggal menjadi pemutus seri, supaya urutannya tetap pasti walau dua
        // kursus kebetulan bernomor sama.
        orderBy: [{ position: 'asc' }, { publishedAt: 'desc' }, { title: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const items = courses.map((course) => {
      const enrollment = course.enrollments[0];
      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        thumbnailUrl: course.thumbnailUrl,
        shortDescription: course.shortDescription,
        level: course.level,
        estimatedMinutes: course.estimatedMinutes,
        category: course.category ? { name: course.category.name, slug: course.category.slug } : null,
        moduleCount: course._count.modules,
        publishedAt: course.publishedAt,
        enrollment: enrollment
          ? {
              status: enrollment.status,
              progressPercent: Number(enrollment.courseProgress?.progressPercent ?? 0),
            }
          : null,
      };
    });

    return { items, total };
  }

  async detail(courseId: string, userId: string) {
    // Statusnya sudah dinilai di sini: kursus belum terbit hanya lolos untuk
    // penyusun kursus, jadi kueri di bawah tidak perlu menyaringnya lagi.
    const akses = await this.access.ensureCourseAccess(userId, courseId);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId },
      include: {
        category: { select: { name: true, slug: true } },
        modules: {
          where: { isActive: true },
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              where: { isActive: true },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                position: true,
                estimatedMinutes: true,
                contentType: true,
                isRequired: true,
                isPreview: true,
              },
            },
          },
        },
        enrollments: {
          where: { userId },
          select: { id: true, status: true, courseProgress: true },
        },
      },
    });

    if (!course) throw AppError.notFound();

    const enrollment = course.enrollments[0];
    const hasAccess =
      enrollment !== undefined &&
      enrollment.status !== EnrollmentStatus.REMOVED &&
      enrollment.status !== EnrollmentStatus.EXPIRED;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      thumbnailUrl: course.thumbnailUrl,
      shortDescription: course.shortDescription,
      description: course.description,
      level: course.level,
      estimatedMinutes: course.estimatedMinutes,
      category: course.category ? { name: course.category.name, slug: course.category.slug } : null,
      publishedAt: course.publishedAt,
      modules: course.modules.map((module) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        position: module.position,
        estimatedMinutes: module.estimatedMinutes,
        lessonCount: module.lessons.length,
        // Tanpa akses, judul pelajaran tetap ditampilkan sebagai silabus,
        // tetapi isinya hanya dapat dibuka lewat endpoint /learn.
        lessons: module.lessons,
      })),
      access: {
        enrolled: hasAccess,
        status: enrollment?.status ?? null,
        progressPercent: Number(enrollment?.courseProgress?.progressPercent ?? 0),
        lastLessonId: enrollment?.courseProgress?.lastLessonId ?? null,
        preview: akses.preview,
      },
    };
  }
}
