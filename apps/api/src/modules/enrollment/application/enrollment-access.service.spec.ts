import { EnrollmentStatus, PublicationStatus } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { MembershipAccessPort } from '../../../shared/access/membership.port';
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
  berbayar?: boolean;
  pelajaran?: { id: string; isActive: boolean; isPreview: boolean; courseId?: string } | null;
}

function buat({
  status = PublicationStatus.PUBLISHED,
  kursusAda = true,
  lessons = [],
  existing = null,
  bolehPratinjau = false,
  berbayar = true,
  pelajaran = { id: 'lesson-1', isActive: true, isPreview: false },
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
      findMany: jest.fn().mockResolvedValue([{ id: 'course-1' }, { id: 'course-2' }]),
    },
    lesson: {
      findUnique: jest.fn().mockResolvedValue(
        pelajaran
          ? {
              id: pelajaran.id,
              isActive: pelajaran.isActive,
              isPreview: pelajaran.isPreview,
              module: { isActive: true, courseId: pelajaran.courseId ?? 'course-1' },
            }
          : null,
      ),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;

  const pratinjau: CoursePreviewAccessPort = {
    bolehPratinjauKursus: jest.fn().mockResolvedValue(bolehPratinjau),
  };
  const keanggotaan: MembershipAccessPort = {
    anggotaBerbayar: jest.fn().mockResolvedValue(berbayar),
  };

  return {
    service: new EnrollmentAccessService(prisma, pratinjau, keanggotaan),
    tx,
    prisma,
    pratinjau,
    keanggotaan,
  };
}

describe('EnrollmentAccessService untuk anggota berbayar', () => {
  it('membuat wadah progres saat kursus dibuka', async () => {
    const { service, tx } = buat({ lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }] });

    const access = await service.assertActiveAccess('user-1', 'course-1');

    expect(access).toEqual({
      enrollmentId: ENROLLMENT.id,
      userId: ENROLLMENT.userId,
      courseId: ENROLLMENT.courseId,
      status: ENROLLMENT.status,
      preview: false,
      berhakIsi: true,
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
      data: { status: EnrollmentStatus.ACTIVE, removedAt: null },
    });
  });

  it('tidak menanyakan hak pratinjau ketika keanggotaannya sudah menjawab', async () => {
    // Jalur pelajar berbayar adalah jalur terpanas di aplikasi ini. Pertanyaan
    // kedua ke modul identity hanya muncul untuk yang belum terjawab.
    const { service, pratinjau } = buat({ berbayar: true });

    await service.assertActiveAccess('user-1', 'course-1');

    expect(pratinjau.bolehPratinjauKursus).not.toHaveBeenCalled();
  });
});

describe('EnrollmentAccessService untuk akun gratis', () => {
  it('mengizinkan masuk kursus tanpa membuat enrollment', async () => {
    // Katalog dan daftar pelajaran harus tetap terlihat. Yang tidak boleh
    // adalah baris enrollment, karena angka "Terdaftar" milik Master berhenti
    // berarti "pelajar berbayar" begitu akun gratis ikut terhitung (ADR-032).
    const { service, tx } = buat({ berbayar: false });

    const access = await service.assertActiveAccess('user-1', 'course-1');

    expect(access.enrollmentId).toBeNull();
    expect(access.status).toBeNull();
    expect(access.berhakIsi).toBe(false);
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.courseProgress.upsert).not.toHaveBeenCalled();
  });

  it('menolak isi pelajaran biasa dengan 402, bukan 403', async () => {
    // 402 punya jalan keluar yang dapat ditawarkan; 403 tidak. Web membedakan
    // keduanya untuk memutuskan apakah mengarahkan ke halaman bayar.
    const { service } = buat({
      berbayar: false,
      pelajaran: { id: 'lesson-1', isActive: true, isPreview: false },
    });

    await expect(service.assertLessonAccess('user-1', 'lesson-1')).rejects.toMatchObject({
      code: 'MEMBERSHIP_REQUIRED',
      status: 402,
    });
  });

  it('mengizinkan pelajaran yang ditandai pratinjau oleh Master', async () => {
    const { service } = buat({
      berbayar: false,
      pelajaran: { id: 'lesson-1', isActive: true, isPreview: true },
    });

    await expect(service.assertLessonAccess('user-1', 'lesson-1')).resolves.toMatchObject({
      lessonId: 'lesson-1',
      enrollmentId: null,
      berhakIsi: false,
    });
  });

  it('tidak menyusuri seluruh katalog untuk membuat enrollment', async () => {
    const { service, prisma } = buat({ berbayar: false });

    await service.ensureAllPublishedCourseAccess('user-1');

    // Tanpa jalan pintas ini, satu kali membuka katalog berarti satu kueri per
    // kursus yang hasilnya pasti dibuang.
    expect(prisma.course.findMany).not.toHaveBeenCalled();
  });
});

describe('EnrollmentAccessService untuk penyusun kursus', () => {
  it('melewatkan gerbang isi meski tidak punya pesanan berbayar', async () => {
    // Master harus dapat memeriksa materinya sendiri. Gerbang yang menahannya
    // pada kursus yang sudah terbit membuat pemeriksaan itu mustahil.
    const { service } = buat({
      berbayar: false,
      bolehPratinjau: true,
      pelajaran: { id: 'lesson-1', isActive: true, isPreview: false },
    });

    await expect(service.assertLessonAccess('user-1', 'lesson-1')).resolves.toMatchObject({
      berhakIsi: true,
    });
  });
});

describe('EnrollmentAccessService pratinjau kursus belum terbit', () => {
  it('menolak pelajar dengan 404, bukan 403', async () => {
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
