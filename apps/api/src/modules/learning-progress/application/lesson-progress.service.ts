import { Injectable } from '@nestjs/common';
import { EnrollmentStatus, LessonContentType, LessonProgressStatus, Prisma } from '@prisma/client';
import { PrismaService, type PrismaTransaction } from '../../../infrastructure/prisma/prisma.service';
import { OutboxWriter } from '../../../infrastructure/outbox/outbox.writer';
import { AppError } from '../../../shared/errors/app-error';
import type { CourseAccess } from '../../enrollment/application/enrollment-access.service';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';
import { flattenLessons, nextIncomplete } from '../../learning-delivery/application/lesson-navigation';
import { calculateProgress } from './progress-calculation';

export interface CompleteLessonCommand {
  userId: string;
  lessonId: string;
  sessionId?: string;
  activeSeconds?: number;
  videoPercentage?: number;
}

export interface CompleteLessonResult {
  lessonStatus: LessonProgressStatus;
  courseProgress: number;
  courseStatus: EnrollmentStatus;
  nextLessonId: string | null;
}

@Injectable()
export class LessonProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
    private readonly outbox: OutboxWriter,
  ) {}

  /** Menandai pelajaran sudah dibuka. Aman dipanggil berulang. */
  async open(userId: string, lessonId: string, sessionId?: string): Promise<{ status: LessonProgressStatus }> {
    const access = await this.access.assertLessonAccess(userId, lessonId);
    const now = new Date();

    const progress = await this.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: access.enrollmentId, lessonId } },
      create: {
        enrollmentId: access.enrollmentId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        viewCount: 1,
        firstOpenedAt: now,
        lastOpenedAt: now,
      },
      update: {
        viewCount: { increment: 1 },
        lastOpenedAt: now,
        // Pelajaran yang sudah selesai tidak turun statusnya karena dibuka lagi.
        status: undefined,
      },
    });

    await this.prisma.courseProgress.updateMany({
      where: { enrollmentId: access.enrollmentId },
      data: { lastLessonId: lessonId, lastActivityAt: now },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.append(tx, {
        eventType: 'learning.lesson_opened',
        aggregateType: 'enrollment',
        aggregateId: access.enrollmentId,
        payload: {
          userId,
          courseId: access.courseId,
          lessonId,
          learningSessionId: sessionId ?? null,
          occurredAt: now.toISOString(),
        },
      });
    });

    return { status: progress.status };
  }

  /**
   * Menandai pelajaran selesai atas permintaan pelajar.
   *
   * Pelajaran berjenis kuis ditolak di sini: penyelesaiannya hanya boleh lahir
   * dari penilaian server atas jawaban yang dikirim, bukan dari klien yang
   * menyatakan dirinya sudah selesai. Tanpa penjagaan ini setiap kuis dapat
   * dilewati dengan satu permintaan biasa ke endpoint ini.
   */
  async complete(command: CompleteLessonCommand): Promise<CompleteLessonResult> {
    const access = await this.access.assertLessonAccess(command.userId, command.lessonId);

    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: command.lessonId },
      select: { contentType: true },
    });
    if (lesson.contentType === LessonContentType.QUIZ) {
      throw AppError.validation({
        lesson: ['Pelajaran kuis selesai dengan mengerjakan kuisnya sampai lulus.'],
      });
    }

    return this.prisma.$transaction((tx) => this.completeWithin(tx, access, command));
  }

  /**
   * Menandai pelajaran selesai di dalam transaksi milik pemanggil.
   *
   * Seluruh perubahan berada dalam satu transaksi (Architecture bagian 13):
   * status pelajaran, hitung ulang progres kursus, penyelesaian kursus, dan
   * penulisan outbox. Notifikasi serta analytics diproses worker setelah
   * commit, jadi keduanya tidak dapat menggagalkan penyelesaian pelajaran.
   *
   * Transaksinya diterima dari luar, bukan dibuka sendiri, supaya modul kuis
   * dapat menyimpan hasil percobaan dan menandai pelajaran selesai sebagai satu
   * kesatuan — kalau tidak, kegagalan di antara keduanya menyisakan percobaan
   * yang lulus tetapi pelajaran yang belum selesai, sementara jatah percobaan
   * pelajar sudah terpakai.
   */
  async completeWithin(
    tx: PrismaTransaction,
    access: CourseAccess,
    command: CompleteLessonCommand,
  ): Promise<CompleteLessonResult> {
    const now = new Date();

    const transitioned = await markLessonCompleted(tx, {
      enrollmentId: access.enrollmentId,
      lessonId: command.lessonId,
      activeSeconds: command.activeSeconds ?? 0,
      evidence: {
        activeSeconds: command.activeSeconds ?? null,
        videoPercentage: command.videoPercentage ?? null,
      },
    });

    const counts = await countRequiredLessons(tx, access.courseId, access.enrollmentId);
    const { percent, isCourseComplete } = calculateProgress(counts);

    const previous = await tx.courseProgress.findUnique({
      where: { enrollmentId: access.enrollmentId },
      select: { completedAt: true },
    });
    const alreadyComplete = previous?.completedAt != null;
    const completedAt = isCourseComplete ? (previous?.completedAt ?? now) : null;

    await tx.courseProgress.upsert({
      where: { enrollmentId: access.enrollmentId },
      create: {
        enrollmentId: access.enrollmentId,
        requiredLessonsTotal: counts.requiredTotal,
        requiredLessonsComplete: counts.requiredCompleted,
        progressPercent: new Prisma.Decimal(percent),
        lastLessonId: command.lessonId,
        startedAt: now,
        lastActivityAt: now,
        completedAt,
        version: 1,
      },
      update: {
        requiredLessonsTotal: counts.requiredTotal,
        requiredLessonsComplete: counts.requiredCompleted,
        progressPercent: new Prisma.Decimal(percent),
        lastLessonId: command.lessonId,
        lastActivityAt: now,
        completedAt,
        startedAt: previous ? undefined : now,
        version: { increment: 1 },
      },
    });

    let enrollmentStatus = access.status;
    if (isCourseComplete && !alreadyComplete) {
      await tx.enrollment.update({
        where: { id: access.enrollmentId },
        data: { status: EnrollmentStatus.COMPLETED, completedAt: now },
      });
      enrollmentStatus = EnrollmentStatus.COMPLETED;
    }

    // Event hanya ditulis pada perubahan status yang sesungguhnya, sehingga
    // percobaan ulang tidak menghasilkan notifikasi ganda.
    if (transitioned) {
      await this.outbox.append(tx, {
        eventType: 'learning.lesson_completed',
        aggregateType: 'enrollment',
        aggregateId: access.enrollmentId,
        payload: {
          userId: command.userId,
          courseId: access.courseId,
          lessonId: command.lessonId,
          learningSessionId: command.sessionId ?? null,
          activeSeconds: command.activeSeconds ?? null,
          videoPercentage: command.videoPercentage ?? null,
          courseProgressPercent: percent,
          occurredAt: now.toISOString(),
        },
      });
    }

    if (isCourseComplete && !alreadyComplete) {
      await this.outbox.append(tx, {
        eventType: 'learning.course_completed',
        aggregateType: 'enrollment',
        aggregateId: access.enrollmentId,
        payload: {
          userId: command.userId,
          courseId: access.courseId,
          completedAt: now.toISOString(),
        },
      });
    }

    const nextLessonId = await resolveNextLesson(tx, access.courseId, access.enrollmentId);

    return {
      lessonStatus: LessonProgressStatus.COMPLETED,
      courseProgress: percent,
      courseStatus: enrollmentStatus,
      nextLessonId,
    };
  }
}

/**
 * Upsert atomik dengan penjaga status.
 *
 * SQL mentah dipakai di sini karena `ON CONFLICT ... DO UPDATE ... WHERE`
 * memberi jawaban tepat atas pertanyaan "apakah baris ini baru saja berpindah
 * ke COMPLETED?" dalam satu perintah. Padanan Prisma-nya membutuhkan baca lalu
 * tulis, yang membuka celah balapan antara dua permintaan bersamaan.
 * Diizinkan ADR-011: terparameterisasi, diuji, dan didokumentasikan.
 */
async function markLessonCompleted(
  tx: PrismaTransaction,
  params: {
    enrollmentId: string;
    lessonId: string;
    activeSeconds: number;
    evidence: Record<string, unknown>;
  },
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO lesson_progress (
      id, enrollment_id, lesson_id, status, view_count, total_seconds,
      first_opened_at, last_opened_at, completed_at, completion_evidence,
      version, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), ${params.enrollmentId}::uuid, ${params.lessonId}::uuid,
      'COMPLETED', 1, ${params.activeSeconds},
      now(), now(), now(), ${JSON.stringify(params.evidence)}::jsonb,
      1, now(), now()
    )
    ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
      status = 'COMPLETED',
      completed_at = COALESCE(lesson_progress.completed_at, now()),
      completion_evidence = ${JSON.stringify(params.evidence)}::jsonb,
      total_seconds = lesson_progress.total_seconds + ${params.activeSeconds},
      last_opened_at = now(),
      version = lesson_progress.version + 1,
      updated_at = now()
    WHERE lesson_progress.status <> 'COMPLETED'
    RETURNING id
  `;

  // Nol baris berarti pelajaran sudah COMPLETED sebelumnya.
  return rows.length > 0;
}

async function countRequiredLessons(
  tx: PrismaTransaction,
  courseId: string,
  enrollmentId: string,
): Promise<{ requiredTotal: number; requiredCompleted: number }> {
  const requiredTotal = await tx.lesson.count({
    where: { isRequired: true, isActive: true, module: { courseId, isActive: true } },
  });

  const requiredCompleted = await tx.lessonProgress.count({
    where: {
      enrollmentId,
      status: LessonProgressStatus.COMPLETED,
      lesson: { isRequired: true, isActive: true, module: { courseId, isActive: true } },
    },
  });

  return { requiredTotal, requiredCompleted };
}

async function resolveNextLesson(
  tx: PrismaTransaction,
  courseId: string,
  enrollmentId: string,
): Promise<string | null> {
  const modules = await tx.courseModule.findMany({
    where: { courseId, isActive: true },
    orderBy: { position: 'asc' },
    include: { lessons: { where: { isActive: true }, orderBy: { position: 'asc' } } },
  });

  const completedRows = await tx.lessonProgress.findMany({
    where: { enrollmentId, status: LessonProgressStatus.COMPLETED },
    select: { lessonId: true },
  });

  return nextIncomplete(
    flattenLessons(modules),
    new Set(completedRows.map((row) => row.lessonId)),
  );
}
