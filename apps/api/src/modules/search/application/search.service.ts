import { Injectable } from '@nestjs/common';
import { ForumTopicStatus, Prisma } from '@prisma/client';
import type { PermissionCode } from '@lms/contracts';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AnnouncementService } from '../../announcement/application/announcement.service';

export const SEARCH_TYPES = ['users', 'courses', 'lessons', 'forum', 'announcements'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;
  /** Keterangan pendek: nama kursus, modul, atau email — tergantung jenisnya. */
  subtitle: string | null;
  /** Tautan relatif ke objeknya. */
  url: string;
}

export interface SearchGroup {
  type: SearchType;
  total: number;
  items: SearchHit[];
}

export interface Searcher {
  id: string;
  permissions: PermissionCode[];
}

/** Batas hasil per jenis; pencarian global untuk menemukan, bukan menelusuri. */
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 25;

/**
 * Pencarian lintas area (PRD 10).
 *
 * Aturan yang menentukan benar-tidaknya fitur ini bukan relevansi hasilnya,
 * melainkan cakupannya: setiap kueri disempitkan menurut siapa yang bertanya.
 * Pelajar tidak boleh menemukan pengguna lain, kursus draft, materi kursus yang
 * tidak diikutinya, topik yang disembunyikan, maupun pengumuman yang bukan
 * untuknya. Pencarian adalah jalan pintas ke data — kalau cakupannya lalai,
 * ia menjadi jalan pintas melewati otorisasi.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcements: AnnouncementService,
  ) {}

  async search(
    searcher: Searcher,
    keyword: string,
    types: SearchType[] | undefined,
    limit: number | undefined,
  ): Promise<SearchGroup[]> {
    const term = keyword.trim();
    if (term.length === 0) return [];

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const wanted = new Set<SearchType>(types && types.length > 0 ? types : SEARCH_TYPES);

    const groups = await Promise.all(
      [...SEARCH_TYPES]
        .filter((type) => wanted.has(type))
        .map((type) => this.searchOne(type, searcher, term, take)),
    );
    return groups.filter((group): group is SearchGroup => group !== null);
  }

  private searchOne(
    type: SearchType,
    searcher: Searcher,
    term: string,
    take: number,
  ): Promise<SearchGroup | null> {
    switch (type) {
      case 'users':
        return this.users(searcher, term, take);
      case 'courses':
        return this.courses(searcher, term, take);
      case 'lessons':
        return this.lessons(searcher, term, take);
      case 'forum':
        return this.forum(searcher, term, take);
      case 'announcements':
        return this.announcementHits(searcher, term, take);
    }
  }

  private can(searcher: Searcher, permission: PermissionCode): boolean {
    return searcher.permissions.includes(permission);
  }

  /** `insensitive` di seluruh berkas ini memenuhi "pencarian tidak case-sensitive". */
  private contains(term: string): Prisma.StringFilter {
    return { contains: term, mode: 'insensitive' };
  }

  private async users(searcher: Searcher, term: string, take: number): Promise<SearchGroup | null> {
    // Tanpa pagar ini, pencarian menjadi direktori pengguna bagi siapa pun.
    if (!this.can(searcher, 'users.read')) return null;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      OR: [{ fullName: this.contains(term) }, { email: this.contains(term) }],
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        take,
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, email: true },
      }),
    ]);

    return {
      type: 'users',
      total,
      items: rows.map((row) => ({
        type: 'users' as const,
        id: row.id,
        title: row.fullName,
        subtitle: row.email,
        url: `/master/users?search=${encodeURIComponent(row.email)}`,
      })),
    };
  }

  private async courses(searcher: Searcher, term: string, take: number): Promise<SearchGroup> {
    const isManager = this.can(searcher, 'courses.manage');
    const where: Prisma.CourseWhereInput = {
      OR: [{ title: this.contains(term) }, { shortDescription: this.contains(term) }],
      // Master melihat draft dan arsip; pelajar hanya yang terbit.
      ...(isManager ? {} : { status: 'PUBLISHED' }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        take,
        orderBy: { title: 'asc' },
        select: { id: true, title: true, status: true, category: { select: { name: true } } },
      }),
    ]);

    return {
      type: 'courses',
      total,
      items: rows.map((row) => ({
        type: 'courses' as const,
        id: row.id,
        title: row.title,
        subtitle: isManager ? `${row.category?.name ?? 'Tanpa kategori'} · ${row.status}` : (row.category?.name ?? null),
        url: isManager ? `/master/courses/${row.id}` : `/courses/${row.id}`,
      })),
    };
  }

  private async lessons(searcher: Searcher, term: string, take: number): Promise<SearchGroup> {
    const isManager = this.can(searcher, 'courses.manage');
    // Pelajar hanya menemukan materi dari kursus yang benar-benar diikutinya.
    // Tanpa ini, judul materi berbayar dapat dipanen tanpa membayar.
    const moduleScope: Prisma.CourseModuleWhereInput = {
      isActive: true,
      ...(isManager
        ? {}
        : { course: { enrollments: { some: { userId: searcher.id, status: 'ACTIVE' } } } }),
    };

    const where: Prisma.LessonWhereInput = {
      isActive: true,
      module: moduleScope,
      OR: [{ title: this.contains(term) }, { description: this.contains(term) }],
    };

    const [total, rows] = await Promise.all([
      this.prisma.lesson.count({ where }),
      this.prisma.lesson.findMany({
        where,
        take,
        orderBy: { title: 'asc' },
        select: {
          id: true,
          title: true,
          module: { select: { title: true, course: { select: { id: true, title: true } } } },
        },
      }),
    ]);

    return {
      type: 'lessons',
      total,
      items: rows.map((row) => ({
        type: 'lessons' as const,
        id: row.id,
        title: row.title,
        subtitle: `${row.module.course.title} · ${row.module.title}`,
        url: `/learn/${row.module.course.id}/${row.id}`,
      })),
    };
  }

  private async forum(searcher: Searcher, term: string, take: number): Promise<SearchGroup> {
    const isModerator = this.can(searcher, 'discussions.moderate');
    const where: Prisma.ForumTopicWhereInput = {
      deletedAt: null,
      OR: [{ title: this.contains(term) }, { body: this.contains(term) }],
      ...(isModerator
        ? {}
        : {
            // Topik tersembunyi tidak boleh muncul lewat pencarian, sama seperti
            // ia tidak muncul di daftar forum.
            status: { not: ForumTopicStatus.HIDDEN },
            course: { enrollments: { some: { userId: searcher.id, status: 'ACTIVE' } } },
          }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.forumTopic.count({ where }),
      this.prisma.forumTopic.findMany({
        where,
        take,
        orderBy: { lastActivityAt: 'desc' },
        select: {
          id: true,
          title: true,
          courseId: true,
          course: { select: { title: true } },
          author: { select: { fullName: true } },
        },
      }),
    ]);

    return {
      type: 'forum',
      total,
      items: rows.map((row) => ({
        type: 'forum' as const,
        id: row.id,
        title: row.title,
        subtitle: `${row.course.title} · ${row.author.fullName}`,
        url: isModerator ? '/master/forum' : `/learn/${row.courseId}/forum/${row.id}`,
      })),
    };
  }

  private async announcementHits(
    searcher: Searcher,
    term: string,
    take: number,
  ): Promise<SearchGroup> {
    const isManager = this.can(searcher, 'announcements.manage');
    const keyword: Prisma.AnnouncementWhereInput = {
      OR: [{ title: this.contains(term) }, { body: this.contains(term) }],
    };
    // Aturan kelayakan datang dari AnnouncementService, bukan disalin ke sini.
    const where: Prisma.AnnouncementWhereInput = isManager
      ? keyword
      : { AND: [keyword, this.announcements.visibleTo(searcher.id, new Date())] };

    const [total, rows] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        take,
        orderBy: { publishedAt: 'desc' },
        select: { id: true, title: true, status: true, publishedAt: true },
      }),
    ]);

    return {
      type: 'announcements',
      total,
      items: rows.map((row) => ({
        type: 'announcements' as const,
        id: row.id,
        title: row.title,
        subtitle: isManager ? row.status : null,
        url: isManager ? '/master/announcements' : '/announcements',
      })),
    };
  }
}
