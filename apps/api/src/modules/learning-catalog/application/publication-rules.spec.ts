import { checkPublishable } from './publication-rules';

describe('Aturan terbit kursus', () => {
  it('mengizinkan kursus yang lengkap', () => {
    expect(
      checkPublishable({
        activeModuleCount: 2,
        activeLessonCount: 8,
        requiredLessonCount: 6,
        emptyQuizLessonCount: 0,
      }),
    ).toEqual({ publishable: true, reasons: [] });
  });

  it('menolak kursus tanpa bagian aktif', () => {
    const verdict = checkPublishable({
      activeModuleCount: 0,
      activeLessonCount: 0,
      requiredLessonCount: 0,
      emptyQuizLessonCount: 0,
    });
    expect(verdict.publishable).toBe(false);
    // Seluruh alasan dikumpulkan sekaligus supaya Master tidak memperbaiki
    // satu masalah lalu menemukan masalah berikutnya.
    expect(verdict.reasons).toHaveLength(3);
  });

  it('menolak kursus yang punya pelajaran tetapi tidak ada yang wajib', () => {
    const verdict = checkPublishable({
      activeModuleCount: 1,
      activeLessonCount: 4,
      requiredLessonCount: 0,
      emptyQuizLessonCount: 0,
    });
    expect(verdict.publishable).toBe(false);
    expect(verdict.reasons).toEqual(['Kursus harus memiliki minimal satu pelajaran wajib.']);
  });

  it('menolak kursus yang punya bagian tetapi tanpa pelajaran aktif', () => {
    const verdict = checkPublishable({
      activeModuleCount: 3,
      activeLessonCount: 0,
      requiredLessonCount: 0,
      emptyQuizLessonCount: 0,
    });
    expect(verdict.publishable).toBe(false);
    expect(verdict.reasons).toContain('Kursus harus memiliki minimal satu pelajaran aktif.');
  });

  it('menolak kursus yang punya pelajaran kuis tanpa soal', () => {
    const verdict = checkPublishable({
      activeModuleCount: 1,
      activeLessonCount: 4,
      requiredLessonCount: 4,
      emptyQuizLessonCount: 2,
    });
    expect(verdict.publishable).toBe(false);
    expect(verdict.reasons).toEqual([
      '2 pelajaran kuis belum memiliki soal, sehingga tidak dapat diselesaikan pelajar.',
    ]);
  });
});
