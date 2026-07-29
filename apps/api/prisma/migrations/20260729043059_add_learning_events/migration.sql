-- CreateTable
CREATE TABLE "learning_events" (
    "id" BIGSERIAL NOT NULL,
    "event_uuid" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "user_id" UUID,
    "session_id" UUID,
    "course_id" UUID,
    "module_id" UUID,
    "lesson_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_seconds" INTEGER,
    "device_type" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_events_event_uuid_key" ON "learning_events"("event_uuid");

-- CreateIndex
CREATE INDEX "learning_events_user_id_occurred_at_idx" ON "learning_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "learning_events_course_id_event_name_occurred_at_idx" ON "learning_events"("course_id", "event_name", "occurred_at");

-- CreateIndex
CREATE INDEX "learning_events_lesson_id_event_name_idx" ON "learning_events"("lesson_id", "event_name");
