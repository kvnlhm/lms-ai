import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';

export interface BookmarkView {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  note: string | null;
  createdAt: Date;
}

/**
 * Materi yang ditandai pelajar untuk dibuka kembali (backlog P1).
 *
 * Bookmark sengaja tidak menyentuh progres sama sekali: menandai materi bukan
 * pernyataan bahwa materinya sudah dibuka atau selesai, dan menghapus bookmark
 * tidak boleh mengubah apa pun tentang riwayat belajar.
 */
@Injectable()
export class BookmarkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
  ) {}

  /**
   * Menandai materi. Idempoten: menandai dua kali hanya memperbarui catatan.
   *
   * Akses diperiksa ulang di sini, bukan hanya saat membuka materi — tanpa itu
   * seseorang dapat menandai materi kursus yang tidak diikutinya, lalu
   * memanen judulnya lewat daftar bookmark.
   */
  async add(userId: string, lessonId: string, note?: string): Promise<{ bookmarked: true }> {
    await this.access.assertLessonAccess(userId, lessonId);

    await this.prisma.userBookmark.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, note: note ?? null },
      update: { note: note ?? null },
    });
    return { bookmarked: true };
  }

  /**
   * Menghapus tanda.
   *
   * Tidak membedakan "tidak ada" dari "berhasil dihapus": hasil akhirnya sama —
   * materi itu tidak lagi ditandai — dan membedakannya hanya akan membuat
   * tombol di antarmuka gagal karena hal yang tidak perlu dipedulikan siapa pun.
   */
  async remove(userId: string, lessonId: string): Promise<{ bookmarked: false }> {
    await this.prisma.userBookmark.deleteMany({ where: { userId, lessonId } });
    return { bookmarked: false };
  }

  async list(userId: string): Promise<BookmarkView[]> {
    const rows = await this.prisma.userBookmark.findMany({
      where: {
        userId,
        // Bookmark ke materi yang sudah dinonaktifkan atau kursus yang aksesnya
        // berakhir tidak ditampilkan: tautannya hanya akan berujung pada 404.
        lesson: { isActive: true, module: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        note: true,
        createdAt: true,
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: { title: true, course: { select: { id: true, title: true } } },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      lessonId: row.lesson.id,
      lessonTitle: row.lesson.title,
      moduleTitle: row.lesson.module.title,
      courseId: row.lesson.module.course.id,
      courseTitle: row.lesson.module.course.title,
      note: row.note,
      createdAt: row.createdAt,
    }));
  }

  /** Dipakai halaman materi untuk menentukan keadaan tombolnya. */
  async isBookmarked(userId: string, lessonId: string): Promise<boolean> {
    const count = await this.prisma.userBookmark.count({ where: { userId, lessonId } });
    return count > 0;
  }
}
