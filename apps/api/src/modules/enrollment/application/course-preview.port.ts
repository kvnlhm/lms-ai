/**
 * Pertanyaan yang diajukan modul enrollment kepada modul identity ketika
 * seseorang membuka kursus yang belum terbit.
 *
 * Jawabannya bergantung pada permission, dan permission adalah milik identity.
 * Membaca tabel `user_roles` dari sini akan melanggar batas modul (AGENTS.md
 * bagian 6), jadi yang dilintasi hanyalah pertanyaan ini.
 */
export const COURSE_PREVIEW_ACCESS = Symbol('COURSE_PREVIEW_ACCESS');

export interface CoursePreviewAccessPort {
  /** Benar bila pengguna ini boleh melihat kursus di luar status terbit. */
  bolehPratinjauKursus(userId: string): Promise<boolean>;
}
