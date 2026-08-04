import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PERMISSIONS } from '@lms/contracts';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { CoursePreviewAccessPort } from '../../enrollment/application/course-preview.port';

/**
 * Jawaban identity atas pertanyaan "boleh melihat kursus yang belum terbit?".
 *
 * Hak ini sengaja diikatkan pada permission `courses.manage`, bukan pada kode
 * role. Siapa pun yang boleh menyusun kursus harus dapat memeriksa hasilnya
 * sebelum menerbitkannya; sebaliknya, role baru yang kelak dibuat tanpa
 * permission itu tidak diam-diam ikut mendapat akses.
 *
 * Sumbernya database, bukan session, karena pemanggilnya hanya menerima userId
 * — dan karena permission dari klien memang tidak boleh dipercaya (AGENTS.md
 * bagian 6). Biayanya hanya muncul pada kursus yang tidak terbit; jalur normal
 * pelajar tidak pernah sampai ke sini.
 */
@Injectable()
export class CoursePreviewAccessService implements CoursePreviewAccessPort {
  constructor(private readonly prisma: PrismaService) {}

  async bolehPratinjauKursus(userId: string): Promise<boolean> {
    const penugasan = await this.prisma.userRole.findFirst({
      where: {
        userId,
        // Akun yang sudah dinonaktifkan tidak lagi membawa hak apa pun,
        // sekalipun sesinya masih tersimpan.
        user: { status: UserStatus.ACTIVE, deletedAt: null },
        role: { permissions: { some: { permission: { code: PERMISSIONS.COURSES_MANAGE } } } },
      },
      select: { userId: true },
    });
    return penugasan !== null;
  }
}
