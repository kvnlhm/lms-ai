import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import type { CourseAccess } from '../../enrollment/application/enrollment-access.service';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';
import type { CompleteLessonResult } from '../../learning-progress/application/lesson-progress.service';
import { LessonProgressService } from '../../learning-progress/application/lesson-progress.service';
import { gradeAttempt, isPassed, type GradedAttempt, type QuestionKey } from './quiz-grading';

export interface SubmitQuizCommand {
  userId: string;
  lessonId: string;
  answers: Array<{ questionId: string; selectedOptionIds: string[] }>;
}

/**
 * Sisi pelajar dari kuis.
 *
 * Aturan pokoknya satu: kunci jawaban tidak pernah keluar sebelum jawaban
 * dikirim. Karena itu setiap kueri di sini menyebut kolom yang diambil satu
 * per satu — tidak ada `include` polos yang akan diam-diam ikut membawa
 * `isCorrect` begitu ada yang menambah relasi baru.
 */
@Injectable()
export class QuizTakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
    private readonly progress: LessonProgressService,
  ) {}

  /** Soal beserta keadaan percobaan pelajar ini. */
  async forLearner(userId: string, lessonId: string) {
    const access = await this.access.assertLessonAccess(userId, lessonId);
    const quiz = await this.loadForLearner(lessonId);
    const riwayat = await this.attemptState(quiz.id, access.enrollmentId, quiz.maxAttempts);

    return {
      id: quiz.id,
      lessonId,
      passingScore: quiz.passingScore,
      maxAttempts: quiz.maxAttempts,
      showFeedback: quiz.showFeedback,
      totalPoints: quiz.questions.reduce((sum, question) => sum + question.points, 0),
      ...riwayat,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        points: question.points,
        position: question.position,
        options: question.options.map((option) => ({ id: option.id, text: option.text })),
      })),
    };
  }

  /**
   * Menilai satu pengiriman lalu menyimpannya.
   *
   * Penyimpanan percobaan dan penyelesaian pelajaran berada dalam satu
   * transaksi, jadi tidak ada keadaan antara di mana jatah percobaan sudah
   * berkurang tetapi pelajaran belum tercatat selesai.
   */
  async submit(command: SubmitQuizCommand) {
    const access = await this.access.assertLessonAccess(command.userId, command.lessonId);

    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId: command.lessonId },
      select: {
        id: true,
        passingScore: true,
        maxAttempts: true,
        showFeedback: true,
        questions: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            prompt: true,
            explanation: true,
            type: true,
            points: true,
            options: { orderBy: { position: 'asc' }, select: { id: true, isCorrect: true } },
          },
        },
      },
    });
    if (!quiz || quiz.questions.length === 0) throw AppError.notFound();

    const sebelumnya = await this.attemptState(quiz.id, access.enrollmentId, quiz.maxAttempts);
    if (sebelumnya.passed) {
      throw new AppError('VALIDATION_ERROR', 409, 'Kuis ini sudah kamu lulusi.');
    }
    if (sebelumnya.attemptsLeft === 0) {
      throw new AppError('VALIDATION_ERROR', 409, 'Jatah percobaan kuis ini sudah habis.');
    }

    const selectionByQuestion = readSelections(quiz.questions, command.answers);

    const keys: QuestionKey[] = quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      points: question.points,
      correctOptionIds: question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id),
    }));

    const graded = gradeAttempt(keys, selectionByQuestion);
    const passed = isPassed(graded.scorePercent, quiz.passingScore);

    const attempt = await this.simpanPercobaan({
      access,
      command,
      quizId: quiz.id,
      maxAttempts: quiz.maxAttempts,
      graded,
      passed,
      selectionByQuestion,
    });

    const attemptsLeft =
      quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - attempt.attemptNumber);

    return {
      attemptNumber: attempt.attemptNumber,
      scorePercent: graded.scorePercent,
      earnedPoints: graded.earnedPoints,
      totalPoints: graded.totalPoints,
      passingScore: quiz.passingScore,
      passed,
      attemptsLeft: passed ? 0 : attemptsLeft,
      lessonCompleted: passed,
      courseProgress: attempt.progress?.courseProgress ?? null,
      nextLessonId: attempt.progress?.nextLessonId ?? null,
      // Umpan balik hanya dikirim bila Master memang menyalakannya. Selama
      // mati, kunci jawaban tetap tidak pernah meninggalkan server meskipun
      // pelajar mengirim jawaban berulang kali untuk memancingnya.
      review: quiz.showFeedback
        ? quiz.questions.map((question) => {
            const result = graded.results.find((row) => row.questionId === question.id);
            return {
              questionId: question.id,
              prompt: question.prompt,
              explanation: question.explanation,
              isCorrect: result?.isCorrect ?? false,
              earnedPoints: result?.earnedPoints ?? 0,
              points: question.points,
              selectedOptionIds: selectionByQuestion.get(question.id) ?? [],
              correctOptionIds: question.options
                .filter((option) => option.isCorrect)
                .map((option) => option.id),
            };
          })
        : null,
    };
  }

  /**
   * Menyimpan percobaan sekaligus menandai pelajaran selesai bila lulus.
   *
   * Batas percobaan dan status lulus diperiksa ulang di dalam transaksi, bukan
   * hanya di pemanggil. Pemeriksaan di luar memakai hitungan yang sudah usang
   * begitu pengiriman lain menyusul: dua permintaan yang datang saat jatah
   * tersisa satu sama-sama melihat "boleh", lalu yang belakangan menambah
   * percobaan melewati batas. Unique (quiz_id, enrollment_id, attempt_number)
   * tidak menolongnya — nomornya memang berbeda, hanya saja melewati jatah.
   */
  private async simpanPercobaan(params: {
    access: CourseAccess & { lessonId: string };
    command: SubmitQuizCommand;
    quizId: string;
    maxAttempts: number | null;
    graded: GradedAttempt;
    passed: boolean;
    selectionByQuestion: Map<string, string[]>;
  }): Promise<{ attemptNumber: number; progress: CompleteLessonResult | null }> {
    const { access, command, quizId, maxAttempts, graded, passed, selectionByQuestion } = params;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const [terpakai, sudahLulus] = await Promise.all([
          tx.quizAttempt.count({ where: { quizId, enrollmentId: access.enrollmentId } }),
          tx.quizAttempt.count({ where: { quizId, enrollmentId: access.enrollmentId, passed: true } }),
        ]);

        if (sudahLulus > 0) {
          throw new AppError('VALIDATION_ERROR', 409, 'Kuis ini sudah kamu lulusi.');
        }
        if (maxAttempts !== null && terpakai >= maxAttempts) {
          throw new AppError('VALIDATION_ERROR', 409, 'Jatah percobaan kuis ini sudah habis.');
        }

        const created = await tx.quizAttempt.create({
          data: {
            quizId,
            enrollmentId: access.enrollmentId,
            attemptNumber: terpakai + 1,
            scorePercent: new Prisma.Decimal(graded.scorePercent),
            earnedPoints: graded.earnedPoints,
            totalPoints: graded.totalPoints,
            passed,
            answers: {
              create: graded.results.map((result) => ({
                questionId: result.questionId,
                selectedOptionIds: selectionByQuestion.get(result.questionId) ?? [],
                isCorrect: result.isCorrect,
                earnedPoints: result.earnedPoints,
              })),
            },
          },
          select: { attemptNumber: true },
        });

        const progress = passed
          ? await this.progress.completeWithin(tx, access, {
              userId: command.userId,
              lessonId: command.lessonId,
            })
          : null;

        return { attemptNumber: created.attemptNumber, progress };
      });
    } catch (caught) {
      // P2002 di sini berarti nomor percobaan itu sudah direbut pengiriman
      // lain. Dijawab 409, bukan dibiarkan menjadi 500 yang membuat pelajar
      // mengira sistemnya rusak padahal jawabannya memang dikirim dua kali.
      if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
        throw new AppError(
          'VALIDATION_ERROR',
          409,
          'Jawaban ini sedang diproses. Tunggu sebentar lalu periksa hasilnya.',
        );
      }
      throw caught;
    }
  }

  private async loadForLearner(lessonId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      select: {
        id: true,
        passingScore: true,
        maxAttempts: true,
        showFeedback: true,
        questions: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            prompt: true,
            type: true,
            points: true,
            position: true,
            options: { orderBy: { position: 'asc' }, select: { id: true, text: true } },
          },
        },
      },
    });

    // Pelajaran berjenis kuis yang soalnya belum disusun tidak dapat
    // dikerjakan. Diperlakukan sebagai tidak ada, bukan sebagai kuis kosong,
    // supaya klien tidak menampilkan formulir yang mustahil dikirim.
    if (!quiz || quiz.questions.length === 0) throw AppError.notFound();
    return quiz;
  }

  private async attemptState(quizId: string, enrollmentId: string, maxAttempts: number | null) {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId, enrollmentId },
      orderBy: { attemptNumber: 'asc' },
      select: { attemptNumber: true, scorePercent: true, passed: true, submittedAt: true },
    });

    const best = attempts.reduce<number | null>(
      (tertinggi, attempt) => Math.max(tertinggi ?? 0, Number(attempt.scorePercent)),
      null,
    );

    return {
      attemptsUsed: attempts.length,
      attemptsLeft: maxAttempts === null ? null : Math.max(0, maxAttempts - attempts.length),
      passed: attempts.some((attempt) => attempt.passed),
      bestScorePercent: best,
      lastAttemptAt: attempts.at(-1)?.submittedAt ?? null,
    };
  }
}

/**
 * Mencocokkan jawaban yang masuk dengan soal yang benar-benar ada.
 *
 * Id soal maupun id pilihan datang dari klien, jadi keduanya diperiksa balik
 * ke isi kuis. Tanpa itu, pilihan milik soal lain — atau milik kuis lain —
 * dapat dikirim dan penilaiannya menjadi tidak berarti.
 */
function readSelections(
  questions: Array<{ id: string; type: string; options: Array<{ id: string }> }>,
  answers: Array<{ questionId: string; selectedOptionIds: string[] }>,
): Map<string, string[]> {
  const masalah: string[] = [];
  const byQuestion = new Map(questions.map((question) => [question.id, question]));
  const selections = new Map<string, string[]>();

  for (const answer of answers) {
    const question = byQuestion.get(answer.questionId);
    if (!question) {
      masalah.push('Ada jawaban untuk soal yang bukan bagian dari kuis ini.');
      continue;
    }
    if (selections.has(answer.questionId)) {
      masalah.push('Satu soal hanya boleh dijawab satu kali dalam satu pengiriman.');
      continue;
    }

    const valid = new Set(question.options.map((option) => option.id));
    const dipilih = [...new Set(answer.selectedOptionIds)];
    if (dipilih.some((id) => !valid.has(id))) {
      masalah.push('Ada pilihan jawaban yang bukan milik soalnya.');
      continue;
    }
    if (question.type === 'SINGLE_CHOICE' && dipilih.length > 1) {
      masalah.push('Soal pilihan tunggal hanya menerima satu jawaban.');
      continue;
    }

    selections.set(answer.questionId, dipilih);
  }

  const belum = questions.filter(
    (question) => (selections.get(question.id) ?? []).length === 0,
  );
  if (belum.length > 0) {
    masalah.push(`Masih ada ${belum.length} soal yang belum dijawab.`);
  }

  if (masalah.length > 0) throw AppError.validation({ answers: [...new Set(masalah)] });
  return selections;
}
