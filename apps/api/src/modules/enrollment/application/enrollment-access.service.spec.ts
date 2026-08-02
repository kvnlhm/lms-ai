import { EnrollmentStatus, PublicationStatus } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { EnrollmentAccessService } from './enrollment-access.service';

describe('EnrollmentAccessService universal authenticated access', () => {
  it('creates a progress enrollment for a logged-in user', async () => {
    const created = {
      id: 'enrollment-1',
      userId: 'user-1',
      courseId: 'course-1',
      status: EnrollmentStatus.ACTIVE,
    };
    const tx = {
      enrollment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn(),
      },
      courseProgress: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      course: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'course-1',
          status: PublicationStatus.PUBLISHED,
          modules: [{ lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }] }],
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    const access = await new EnrollmentAccessService(prisma).assertActiveAccess(
      'user-1',
      'course-1',
    );

    expect(access).toEqual({
      enrollmentId: created.id,
      userId: created.userId,
      courseId: created.courseId,
      status: created.status,
    });
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', courseId: 'course-1', status: EnrollmentStatus.ACTIVE },
    });
    expect(tx.courseProgress.upsert).toHaveBeenCalledWith({
      where: { enrollmentId: 'enrollment-1' },
      create: { enrollmentId: 'enrollment-1', requiredLessonsTotal: 2 },
      update: { requiredLessonsTotal: 2 },
    });
  });

  it('reactivates removed enrollment and clears old access limits', async () => {
    const reactivated = {
      id: 'enrollment-1',
      userId: 'user-1',
      courseId: 'course-1',
      status: EnrollmentStatus.ACTIVE,
    };
    const tx = {
      enrollment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enrollment-1',
          status: EnrollmentStatus.REMOVED,
        }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(reactivated),
      },
      courseProgress: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      course: {
        findFirst: jest.fn().mockResolvedValue({ id: 'course-1', modules: [] }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await new EnrollmentAccessService(prisma).assertActiveAccess('user-1', 'course-1');

    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: {
        status: EnrollmentStatus.ACTIVE,
        accessStartsAt: null,
        accessEndsAt: null,
        removedAt: null,
      },
    });
  });
});
