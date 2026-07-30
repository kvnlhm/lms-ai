export const LESSON_VIDEO_CLEANUP = Symbol('LESSON_VIDEO_CLEANUP');

export interface LessonVideoCleanupPort {
  removeForLessons(lessonIds: string[]): Promise<void>;
}
