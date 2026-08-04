import { Injectable } from '@nestjs/common';
import { EnrollmentStatus, PaymentOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class PaidMembershipAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotently grants a newly published course to every active paid member. */
  async grantPublishedCourse(
    courseId: string,
    requiredLessonsTotal: number,
    grantedAt = new Date(),
  ): Promise<void> {
    // Masa berlaku disaring di sini, pada pesanan — bukan disalin ke enrollment.
    // Keanggotaan yang sudah habis tidak ikut menerima kursus yang baru terbit,
    // sedangkan kursus yang terlanjur dimiliki tetap dapat dibuka selamanya.
    const paidOrders = await this.prisma.registrationOrder.findMany({
      where: {
        status: PaymentOrderStatus.PAID,
        provisionedUserId: { not: null },
        OR: [{ accessEndsAt: null }, { accessEndsAt: { gt: grantedAt } }],
      },
      select: { provisionedUserId: true },
    });
    const anggota = new Set(
      paidOrders.map((order) => order.provisionedUserId).filter((id): id is string => id !== null),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const userId of anggota) {
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
      }
    });
  }
}
