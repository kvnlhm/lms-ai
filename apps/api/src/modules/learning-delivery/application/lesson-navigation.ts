/**
 * Urutan pelajaran dalam satu kursus.
 *
 * Diletakkan terpisah karena dipakai oleh delivery (menentukan pelajaran
 * berikutnya) dan progress (menentukan tujuan setelah menandai selesai),
 * dan karena aturan urutannya perlu diuji tanpa database.
 */
export interface FlatLesson {
  lessonId: string;
  moduleId: string;
  modulePosition: number;
  lessonPosition: number;
  isRequired: boolean;
}

export function flattenLessons(
  modules: Array<{ id: string; position: number; lessons: Array<{ id: string; position: number; isRequired: boolean }> }>,
): FlatLesson[] {
  return [...modules]
    .sort((a, b) => a.position - b.position)
    .flatMap((module) =>
      [...module.lessons]
        .sort((a, b) => a.position - b.position)
        .map((lesson) => ({
          lessonId: lesson.id,
          moduleId: module.id,
          modulePosition: module.position,
          lessonPosition: lesson.position,
          isRequired: lesson.isRequired,
        })),
    );
}

export function neighbours(
  ordered: FlatLesson[],
  lessonId: string,
): { previousLessonId: string | null; nextLessonId: string | null } {
  const index = ordered.findIndex((lesson) => lesson.lessonId === lessonId);
  if (index === -1) return { previousLessonId: null, nextLessonId: null };
  return {
    previousLessonId: ordered[index - 1]?.lessonId ?? null,
    nextLessonId: ordered[index + 1]?.lessonId ?? null,
  };
}

/**
 * Pelajaran yang disarankan berikutnya: yang pertama belum selesai menurut
 * urutan kurikulum. Bila semua sudah selesai, kembalikan null.
 */
export function nextIncomplete(
  ordered: FlatLesson[],
  completedLessonIds: ReadonlySet<string>,
): string | null {
  const candidate = ordered.find((lesson) => !completedLessonIds.has(lesson.lessonId));
  return candidate?.lessonId ?? null;
}
