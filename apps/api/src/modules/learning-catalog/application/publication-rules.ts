/**
 * Aturan kelayakan terbit sebuah kursus (API_CONTRACT bagian 9).
 *
 * Fungsi murni agar dapat diuji tanpa database, dan agar daftar alasan
 * penolakan dapat ditampilkan sekaligus alih-alih satu per satu.
 */
export interface PublicationInput {
  activeModuleCount: number;
  activeLessonCount: number;
  requiredLessonCount: number;
  /** Pelajaran berjenis kuis yang belum punya satu pun soal. */
  emptyQuizLessonCount: number;
}

export interface PublicationVerdict {
  publishable: boolean;
  reasons: string[];
}

export function checkPublishable(input: PublicationInput): PublicationVerdict {
  const reasons: string[] = [];

  if (input.activeModuleCount < 1) {
    reasons.push('Kursus harus memiliki minimal satu bagian aktif.');
  }
  if (input.activeLessonCount < 1) {
    reasons.push('Kursus harus memiliki minimal satu pelajaran aktif.');
  }
  if (input.requiredLessonCount < 1) {
    // Tanpa pelajaran wajib, progres kursus tidak akan pernah bergerak dari
    // nol karena perhitungannya memakai jumlah pelajaran wajib sebagai penyebut.
    reasons.push('Kursus harus memiliki minimal satu pelajaran wajib.');
  }
  if (input.emptyQuizLessonCount > 0) {
    // Pelajaran kuis hanya bisa diselesaikan dengan lulus kuisnya. Bila
    // soalnya belum ada, pelajaran itu mustahil diselesaikan — dan bila ia
    // wajib, progres kursus tidak akan pernah mencapai 100%.
    reasons.push(
      `${input.emptyQuizLessonCount} pelajaran kuis belum memiliki soal, sehingga tidak dapat diselesaikan pelajar.`,
    );
  }

  return { publishable: reasons.length === 0, reasons };
}
