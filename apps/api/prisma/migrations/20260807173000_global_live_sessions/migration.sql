-- Events may be global and therefore do not require a course.
ALTER TABLE "live_sessions" ALTER COLUMN "course_id" DROP NOT NULL;
