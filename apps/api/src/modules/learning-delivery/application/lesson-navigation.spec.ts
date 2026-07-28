import { flattenLessons, neighbours, nextIncomplete } from './lesson-navigation';

describe('lesson navigation', () => {
  const ordered = flattenLessons([
    {
      id: 'module-2',
      position: 2,
      lessons: [{ id: 'lesson-3', position: 1, isRequired: false }],
    },
    {
      id: 'module-1',
      position: 1,
      lessons: [
        { id: 'lesson-2', position: 2, isRequired: true },
        { id: 'lesson-1', position: 1, isRequired: true },
      ],
    },
  ]);

  it('mengurutkan modul dan lesson tanpa memutasi input', () => {
    expect(ordered.map((lesson) => lesson.lessonId)).toEqual(['lesson-1', 'lesson-2', 'lesson-3']);
  });

  it('menentukan tetangga lesson', () => {
    expect(neighbours(ordered, 'lesson-2')).toEqual({
      previousLessonId: 'lesson-1',
      nextLessonId: 'lesson-3',
    });
    expect(neighbours(ordered, 'missing')).toEqual({
      previousLessonId: null,
      nextLessonId: null,
    });
  });

  it('memilih lesson pertama yang belum selesai', () => {
    expect(nextIncomplete(ordered, new Set(['lesson-1']))).toBe('lesson-2');
    expect(nextIncomplete(ordered, new Set(ordered.map((lesson) => lesson.lessonId)))).toBeNull();
  });
});
