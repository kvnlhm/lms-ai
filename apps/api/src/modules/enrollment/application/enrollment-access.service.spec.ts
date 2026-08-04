import { EnrollmentStatus, PublicationStatus } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { CoursePreviewAccessPort } from './course-preview.port';
import { EnrollmentAccessService } from './enrollment-access.service';

const ENROLLMENT = {
  id: 'enrollment-1',
  userId: 'user-1',
  courseId: 'course-1',
  status: EnrollmentStatus.ACTIVE,
};

interface Setelan {
  status?: PublicationStatus;
  /** null berarti kursusnya memang tidak ada. */
  kursusAda?: boolean;
  lessons?: { id: string }[];
  existing?: { id: string; status: EnrollmentStatus } | null;
  bolehPratinjau?: boolean;
}

function buat({
  status = PublicationStatus.PUBLISHED,
  kursusAda = true,
  lessons = [],
  existing = null,
  bolehPratinjau = false,
}: Setelan = {}) {
  const tx = {
    enrollment: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue(ENROLLMENT),
      update: jest.fn().mockResolvedValue(ENROLLMENT),
    },
    courseProgress: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    course: {
      findUnique: jest.fn().mockResolvedValue(
        kursusAda ? { id: 'course-1', status, modules: [{ lessons }] } : null,
      ),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;

  const pratinjau: CoursePreviewAccessPort = {
    bolehPratinjauKursus: jest.fn().mockResolvedValue(bolehPratinjau),
  };

  return { service: new EnrollmentAccessService(prisma, pratinjau), tx, prisma, pratinjau };
}

describe('EnrollmentAccessService universal authenticated access', () => {
  it('creates a progress enrollment for a logged-in user', async () => {
    const { service, tx } = buat({ lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }] });

    const access = await service.assertActiveAccess('user-1', 'course-1');

    expect(access).toEqual({
      enrollmentId: ENROLLMENT.id,
      userId: ENROLLMENT.userId,
      courseId: ENROLLMENT.courseId,
      status: ENROLLMENT.status,
      preview: false,
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

  it('menghidupkan kembali enrollment yang pernah dicabut', async () => {
    const { service, tx } = buat({
      existing: { id: 'enrollment-1', status: EnrollmentStatus.REMOVED },
    });

    await service.assertActiveAccess('user-1', 'course-1');

    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: {
        status: EnrollmentStatus.ACTIVE,
        removedAt: null,
      },
    });
  });

  it('tidak menanyakan hak pratinjau untuk kursus yang sudah terbit', async () => {
    // Jalur pelajar adalah jalur terpanas di aplikasi ini. Pertanyaan ke modul
    // identity hanya boleh muncul ketika kursusnya memang belum terbit.
    const { service, pratinjau } = buat();

    await service.assertActiveAccess('user-1', 'course-1');

    expect(pratinjau.bolehPratinjauKursus).not.toHaveBeenCalled();
  });
});

describe('EnrollmentAccessService pratinjau kursus belum terbit', () => {
  it('menolak pelajar dengan 404, bukan 403', async () => {
    // 403 akan mengonfirmasi bahwa kursusnya ada. Draf yang sedang disusun
    // tidak perlu dikonfirmasi keberadaannya kepada yang tidak berhak.
    const { service } = buat({ status: PublicationStatus.DRAFT, bolehPratinjau: false });

    await expect(service.assertActiveAccess('user-1', 'course-1')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('mengizinkan penyusun kursus membuka draf dan menandainya sebagai pratinjau', async () => {
    const { service } = buat({ status: PublicationStatus.DRAFT, bolehPratinjau: true });

    await expect(service.assertActiveAccess('user-1', 'course-1')).resolves.toMatchObject({
      enrollmentId: ENROLLMENT.id,
      preview: true,
    });
  });

  it('berlaku juga untuk kursus yang sudah diarsipkan', async () => {
    const { service } = buat({ status: PublicationStatus.ARCHIVED, bolehPratinjau: true });

    await expect(service.assertActiveAccess('user-1', 'course-1')).resolves.toMatchObject({
      preview: true,
    });
  });

  it('tetap 404 ketika kursusnya memang tidak ada, tanpa menanyakan permission', async () => {
    const { service, pratinjau } = buat({ kursusAda: false, bolehPratinjau: true });

    await expect(service.assertActiveAccess('user-1', 'course-1')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
    expect(pratinjau.bolehPratinjauKursus).not.toHaveBeenCalled();
  });
});
