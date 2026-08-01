/**
 * Penilaian kuis (PRD 7.17).
 *
 * Fungsi murni, terpisah dari database, karena inilah bagian yang menentukan
 * lulus atau tidaknya seorang pelajar dan karenanya harus dapat diuji tanpa
 * menyiapkan enrollment, kursus, maupun sesi. Kunci jawaban hanya masuk lewat
 * parameter dan tidak pernah ikut keluar bersama hasilnya.
 */

export interface QuestionKey {
  id: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  points: number;
  correctOptionIds: string[];
}

export interface GradedQuestion {
  questionId: string;
  isCorrect: boolean;
  earnedPoints: number;
}

export interface GradedAttempt {
  results: GradedQuestion[];
  earnedPoints: number;
  totalPoints: number;
  scorePercent: number;
}

/**
 * Menilai satu pengiriman.
 *
 * Soal berjawaban ganda dinilai utuh: seluruh pilihan benar harus tertandai
 * dan tidak boleh ada pilihan salah yang ikut. Nilai sebagian sengaja tidak
 * dipakai karena "setengah benar" tidak punya arti tunggal — menandai satu
 * dari tiga jawaban benar tidak setara dengan menandai semuanya lalu menambah
 * satu yang salah, dan aturan apa pun yang menyamakan keduanya akan terasa
 * sewenang-wenang bagi pelajar yang nilainya di ambang lulus.
 */
export function gradeAttempt(
  questions: QuestionKey[],
  selectionByQuestion: Map<string, string[]>,
): GradedAttempt {
  const results = questions.map((question) => {
    const selected = new Set(selectionByQuestion.get(question.id) ?? []);
    const correct = new Set(question.correctOptionIds);
    const isCorrect =
      selected.size === correct.size && [...correct].every((id) => selected.has(id));

    return {
      questionId: question.id,
      isCorrect,
      earnedPoints: isCorrect ? question.points : 0,
    };
  });

  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
  const earnedPoints = results.reduce((sum, result) => sum + result.earnedPoints, 0);

  // Kuis tanpa soal tidak dapat dikirim — dicegah aturan penyuntingan — tetapi
  // pembagian nol tetap dijaga di sini supaya fungsi ini aman berdiri sendiri.
  const scorePercent = totalPoints === 0 ? 0 : round2((earnedPoints / totalPoints) * 100);

  return { results, earnedPoints, totalPoints, scorePercent };
}

/**
 * Ambang lulus dibandingkan pada nilai yang sudah dibulatkan dua desimal,
 * yaitu angka yang sama dengan yang dilihat pelajar. Membandingkan pada nilai
 * mentah membuat 69,999% tampil sebagai "70%" tetapi dinyatakan tidak lulus.
 */
export function isPassed(scorePercent: number, passingScore: number): boolean {
  return scorePercent >= passingScore;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
