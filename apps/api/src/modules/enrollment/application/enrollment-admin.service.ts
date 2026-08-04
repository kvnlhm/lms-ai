import { Injectable } from '@nestjs/common';
import { EnrollmentStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

export interface GrantAccessInput {
  userIds: string[];
}

export interface GrantResult {
  userId: string;
  outcome: 'ENROLLED' | 'REACTIVATED' | 'ALREADY_ENROLLED' | 'USER_NOT_FOUND' | 'USER_INACTIVE';
  enrollmentId?: string;
}

@Injectable()
export class EnrollmentAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCourse(params: {
    courseId: string;
    page: number;
    pageSize: number;
    status?: EnrollmentStatus;
    search?: string;
  }) {
    const course = await this.prisma.course.findUnique({
      where: { id: params.courseId },
      select: { id: true },
    });
    if (!course) throw AppError.notFound();

    const where: Prisma.EnrollmentWhereInput = {
      courseId: params.courseId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            user: {
              OR: [
                { fullName: { contains: params.search, mode: 'insensitive' } },
                { email: { contains: params.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true, status: true } },
          courseProgress: true,
        },
        orderBy: { enrolledAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      status: row.status,
      enrolledAt: row.enrolledAt,
      completedAt: row.completedAt,
      user: row.user,
      progress: {
        percent: Number(row.courseProgress?.progressPercent ?? 0),
        requiredLessonsTotal: row.courseProgress?.requiredLessonsTotal ?? 0,
        requiredLessonsCompleted: row.courseProgress?.requiredLessonsComplete ?? 0,
        lastActivityAt: row.courseProgress?.lastActivityAt ?? null,
      },
    }));

    return { items, total };
  }

  /**
   * Memberi akses ke banyak pengguna sekaligus.
   *
   * Setiap pengguna dilaporkan hasilnya masing-masing alih-alih menggagalkan
   * seluruh permintaan: satu email yang salah ketik tidak boleh membatalkan
   * pendaftaran sembilan orang lain (API_CONTRACT bagian 12).
   */
  async grantAccess(
    courseId: string,
    input: GrantAccessInput,
    actorId: string,
  ): Promise<GrantResult[]> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw AppError.notFound();

    const users = await this.prisma.user.findMany({
      where: { id: { in: input.userIds }, deletedAt: null },
      select: { id: true, status: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    const results: GrantResult[] = [];

    for (const userId of dedupe(input.userIds)) {
      const user = byId.get(userId);
      if (!user) {
        results.push({ userId, outcome: 'USER_NOT_FOUND' });
        continue;
      }
      if (user.status !== UserStatus.ACTIVE) {
        results.push({ userId, outcome: 'USER_INACTIVE' });
        continue;
      }

      const existing = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });

      if (existing) {
        const revoked =
          existing.status === EnrollmentStatus.REMOVED ||
          existing.status === EnrollmentStatus.EXPIRED;

        if (!revoked) {
          results.push({ userId, outcome: 'ALREADY_ENROLLED', enrollmentId: existing.id });
          continue;
        }

        // Enrollment lama dihidupkan kembali, bukan dibuat baru, supaya
        // riwayat progres yang sudah ada tetap melekat.
        const reactivated = await this.prisma.enrollment.update({
          where: { id: existing.id },
          data: {
            status: EnrollmentStatus.ACTIVE,
            removedAt: null,
          },
        });
        results.push({ userId, outcome: 'REACTIVATED', enrollmentId: reactivated.id });
        continue;
      }

      const created = await this.prisma.enrollment.create({
        data: {
          userId,
          courseId,
          enrolledBy: actorId,
        },
      });

      await this.prisma.courseProgress.create({
        data: {
          enrollmentId: created.id,
          requiredLessonsTotal: await this.countRequiredLessons(courseId),
        },
      });

      results.push({ userId, outcome: 'ENROLLED', enrollmentId: created.id });
    }

    return results;
  }

  private async countRequiredLessons(courseId: string): Promise<number> {
    return this.prisma.lesson.count({
      where: { isRequired: true, isActive: true, module: { courseId, isActive: true } },
    });
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
