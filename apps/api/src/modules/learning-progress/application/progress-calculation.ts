/**
 * Perhitungan progres kursus.
 *
 * Fungsi murni, terpisah dari database, supaya aturan pembulatan dan batas
 * atasnya dapat diuji langsung tanpa menyiapkan skenario Postgres.
 */
export interface ProgressSnapshot {
  requiredTotal: number;
  requiredCompleted: number;
}

export interface ProgressResult {
  percent: number;
  isCourseComplete: boolean;
}

export function calculateProgress(snapshot: ProgressSnapshot): ProgressResult {
  const total = Math.max(0, snapshot.requiredTotal);
  // Materi opsional tidak boleh mendorong angka melewati jumlah wajib.
  const completed = Math.min(Math.max(0, snapshot.requiredCompleted), total);

  if (total === 0) {
    // Kursus tanpa pelajaran wajib tidak pernah otomatis dianggap selesai;
    // publikasi kursus mensyaratkan minimal satu pelajaran wajib.
    return { percent: 0, isCourseComplete: false };
  }

  const raw = (completed / total) * 100;
  const percent = Math.min(100, Math.round(raw * 100) / 100);

  return { percent, isCourseComplete: completed >= total };
}
