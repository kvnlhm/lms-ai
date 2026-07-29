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

  return { publishable: reasons.length === 0, reasons };
}
