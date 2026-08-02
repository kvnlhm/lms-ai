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
    const paidOrders = await this.prisma.registrationOrder.findMany({
      where: {
        status: PaymentOrderStatus.PAID,
        provisionedUserId: { not: null },
        OR: [{ accessEndsAt: null }, { accessEndsAt: { gt: grantedAt } }],
      },
      select: { provisionedUserId: true, accessEndsAt: true },
    });
    const memberships = mergeMembershipWindows(paidOrders);

    await this.prisma.$transaction(async (tx) => {
      for (const [userId, accessEndsAt] of memberships) {
        const existing = await tx.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
          select: { id: true, status: true, accessEndsAt: true },
        });
        const effectiveEnd = existing?.accessEndsAt === null || accessEndsAt === null
          ? null
          : laterDate(existing?.accessEndsAt, accessEndsAt);
        const enrollment = existing
          ? await tx.enrollment.update({
              where: { id: existing.id },
              data: {
                ...(existing.status === EnrollmentStatus.COMPLETED
                  ? {}
                  : { status: EnrollmentStatus.ACTIVE }),
                accessEndsAt: effectiveEnd,
                removedAt: null,
              },
            })
          : await tx.enrollment.create({
              data: {
                userId,
                courseId,
                status: EnrollmentStatus.ACTIVE,
                accessStartsAt: grantedAt,
                accessEndsAt,
              },
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

export function mergeMembershipWindows(
  orders: Array<{ provisionedUserId: string | null; accessEndsAt: Date | null }>,
): Map<string, Date | null> {
  const memberships = new Map<string, Date | null>();
  for (const order of orders) {
    if (!order.provisionedUserId) continue;
    const current = memberships.get(order.provisionedUserId);
    if (memberships.has(order.provisionedUserId) && current === null) continue;
    memberships.set(
      order.provisionedUserId,
      current === undefined || order.accessEndsAt === null
        ? order.accessEndsAt
        : laterDate(current, order.accessEndsAt),
    );
  }
  return memberships;
}

function laterDate(current: Date | null | undefined, candidate: Date | null): Date | null {
  if (!candidate) return null;
  if (!current) return candidate;
  return current > candidate ? current : candidate;
}
