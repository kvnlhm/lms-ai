import { Injectable } from '@nestjs/common';
import { LessonContentType } from '@prisma/client';
import { PrismaService, type PrismaTransaction } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

export interface QuizOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionInput {
  /** Diisi untuk soal yang sudah ada; kosong berarti soal baru. */
  id?: string;
  prompt: string;
  explanation?: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  points?: number;
  options: QuizOptionInput[];
}

export interface QuizInput {
  passingScore: number;
  maxAttempts?: number | null;
  showFeedback?: boolean;
  questions: QuizQuestionInput[];
}

/**
 * Penyuntingan kuis oleh Master.
 *
 * Hanya service ini yang mengembalikan `isCorrect`. Sisi pelajar memakai
 * `QuizTakingService`, yang memilih kolom secara eksplisit tanpa kunci jawaban.
 */
@Injectable()
export class QuizAuthoringService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kuis lengkap beserta kunci jawaban. */
  async get(lessonId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } },
        },
        _count: { select: { attempts: true } },
      },
    });
    if (!quiz) throw AppError.notFound();

    return toAuthoringQuiz(quiz);
  }

  /**
   * Menyimpan seluruh isi kuis sekaligus.
   *
   * Bentuknya penggantian menyeluruh — itulah yang cocok dengan editor, tempat
   * Master menyusun daftar soal lalu menekan simpan sekali. Namun soal lama
   * yang masih dipakai payload dikenali lewat `id` dan diperbarui di tempat,
   * bukan dihapus lalu dibuat ulang, supaya jawaban pada percobaan terdahulu
   * tetap menunjuk soal yang sama.
   */
  async save(lessonId: string, input: QuizInput) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, contentType: true },
    });
    if (!lesson) throw AppError.notFound();
    if (lesson.contentType !== LessonContentType.QUIZ) {
      throw AppError.validation({
        contentType: ['Ubah jenis materi pelajaran menjadi Kuis sebelum menyusun soal.'],
      });
    }

    assertAnswerKeysValid(input.questions);

    return this.prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.upsert({
        where: { lessonId },
        create: {
          lessonId,
          passingScore: input.passingScore,
          maxAttempts: input.maxAttempts ?? null,
          showFeedback: input.showFeedback ?? true,
        },
        update: {
          passingScore: input.passingScore,
          maxAttempts: input.maxAttempts ?? null,
          showFeedback: input.showFeedback ?? true,
        },
      });

      const existing = await tx.quizQuestion.findMany({
        where: { quizId: quiz.id },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((row) => row.id));

      const keptIds = new Set<string>();
      for (const question of input.questions) {
        if (question.id === undefined) continue;
        if (!existingIds.has(question.id)) {
          throw AppError.validation({
            questions: ['Ada soal yang menunjuk id di luar kuis ini.'],
          });
        }
        // Id yang sama dua kali akan membuat satu baris ditulis dua kali dengan
        // posisi berbeda, dan salah satu soal lenyap tanpa pesan apa pun.
        if (keptIds.has(question.id)) {
          throw AppError.validation({
            questions: ['Satu soal hanya boleh muncul sekali dalam satu penyimpanan.'],
          });
        }
        keptIds.add(question.id);
      }

      await this.removeQuestions(
        tx,
        [...existingIds].filter((id) => !keptIds.has(id)),
      );

      // Dua fase seperti pengurutan bagian dan pelajaran: posisi digeser ke
      // angka negatif dulu agar unique (quiz_id, position) tidak tertabrak di
      // tengah proses ketika dua soal bertukar tempat.
      for (const [index, id] of [...keptIds].entries()) {
        await tx.quizQuestion.update({ where: { id }, data: { position: -(index + 1) } });
      }

      for (const [index, question] of input.questions.entries()) {
        const position = index + 1;
        const data = {
          prompt: question.prompt,
          explanation: question.explanation ?? null,
          type: question.type,
          points: question.points ?? 1,
          position,
        };

        const questionId = question.id
          ? (await tx.quizQuestion.update({ where: { id: question.id }, data })).id
          : (await tx.quizQuestion.create({ data: { ...data, quizId: quiz.id } })).id;

        // Pilihan selalu ditulis ulang. Tidak ada kunci asing dari jawaban ke
        // pilihan, jadi ini tidak menyentuh riwayat percobaan; yang tersimpan
        // di sana adalah id pilihan pada saat itu, dan riwayat memang
        // dimaksudkan sebagai catatan keadaan lampau.
        if (question.id) await tx.quizOption.deleteMany({ where: { questionId } });
        await tx.quizOption.createMany({
          data: question.options.map((option, optionIndex) => ({
            questionId,
            text: option.text,
            isCorrect: option.isCorrect,
            position: optionIndex + 1,
          })),
        });
      }

      const saved = await tx.quiz.findUniqueOrThrow({
        where: { id: quiz.id },
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: { options: { orderBy: { position: 'asc' } } },
          },
          _count: { select: { attempts: true } },
        },
      });
      return toAuthoringQuiz(saved);
    });
  }

  /**
   * Menghapus kuis beserta soalnya.
   *
   * Ditolak selama ada percobaan, sejalan dengan penghapusan pelajaran dan
   * bagian: riwayat belajar tidak boleh lenyap sebagai efek samping.
   */
  async remove(lessonId: string): Promise<void> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      select: { id: true, _count: { select: { attempts: true } } },
    });
    if (!quiz) throw AppError.notFound();

    if (quiz._count.attempts > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        409,
        'Kuis ini sudah pernah dikerjakan. Ubah soalnya, atau nonaktifkan pelajarannya.',
      );
    }

    await this.prisma.quiz.delete({ where: { id: quiz.id } });
  }

  private async removeQuestions(tx: PrismaTransaction, questionIds: string[]): Promise<void> {
    if (questionIds.length === 0) return;

    const answered = await tx.quizAnswer.findMany({
      where: { questionId: { in: questionIds } },
      distinct: ['questionId'],
      select: { questionId: true },
    });
    if (answered.length > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        409,
        'Soal yang sudah pernah dijawab tidak dapat dihapus. Perbaiki isinya, atau biarkan tetap ada.',
      );
    }

    await tx.quizQuestion.deleteMany({ where: { id: { in: questionIds } } });
  }
}

/**
 * Aturan yang membuat sebuah soal dapat dinilai sama sekali.
 *
 * Tanpa pemeriksaan ini seorang Master dapat menyimpan soal pilihan tunggal
 * tanpa jawaban benar, dan setiap pelajar akan gagal pada soal itu tanpa cara
 * apa pun untuk menjawab dengan benar.
 */
function assertAnswerKeysValid(questions: QuizQuestionInput[]): void {
  const masalah: string[] = [];

  for (const [index, question] of questions.entries()) {
    const nomor = index + 1;
    const benar = question.options.filter((option) => option.isCorrect).length;

    if (question.type === 'SINGLE_CHOICE' && benar !== 1) {
      masalah.push(`Soal ${nomor} berjenis pilihan tunggal, jadi harus tepat satu jawaban benar.`);
    }
    if (question.type === 'MULTIPLE_CHOICE' && benar < 1) {
      masalah.push(`Soal ${nomor} harus memiliki minimal satu jawaban benar.`);
    }
  }

  if (masalah.length > 0) throw AppError.validation({ questions: masalah });
}

function toAuthoringQuiz(quiz: {
  id: string;
  lessonId: string;
  passingScore: number;
  maxAttempts: number | null;
  showFeedback: boolean;
  updatedAt: Date;
  questions: Array<{
    id: string;
    prompt: string;
    explanation: string | null;
    type: string;
    points: number;
    position: number;
    options: Array<{ id: string; text: string; isCorrect: boolean; position: number }>;
  }>;
  _count: { attempts: number };
}) {
  return {
    id: quiz.id,
    lessonId: quiz.lessonId,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    showFeedback: quiz.showFeedback,
    attemptCount: quiz._count.attempts,
    totalPoints: quiz.questions.reduce((sum, question) => sum + question.points, 0),
    updatedAt: quiz.updatedAt,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      explanation: question.explanation,
      type: question.type,
      points: question.points,
      position: question.position,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        position: option.position,
      })),
    })),
  };
}
