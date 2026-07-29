CREATE TYPE "VideoProvider" AS ENUM ('SELF_HOSTED', 'BUNNY_STREAM');
CREATE TYPE "VideoStatus" AS ENUM ('CREATED', 'UPLOADING', 'PROCESSING', 'AVAILABLE', 'FAILED', 'DELETED');
CREATE TYPE "PlaybackStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED', 'REVOKED');

CREATE TABLE "video_assets" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "provider" "VideoProvider" NOT NULL DEFAULT 'SELF_HOSTED',
    "provider_video_id" TEXT NOT NULL,
    "object_key" TEXT,
    "original_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'CREATED',
    "processing_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "video_playback_sessions" (
    "id" UUID NOT NULL,
    "video_asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "device_id" TEXT,
    "status" "PlaybackStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    CONSTRAINT "video_playback_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_assets_provider_video_id_key" ON "video_assets"("provider_video_id");
CREATE INDEX "video_assets_lesson_id_status_idx" ON "video_assets"("lesson_id", "status");
CREATE UNIQUE INDEX "video_assets_one_live_per_lesson"
    ON "video_assets"("lesson_id")
    WHERE "deleted_at" IS NULL AND "status" <> 'DELETED';
CREATE INDEX "video_playback_sessions_user_id_status_expires_at_idx"
    ON "video_playback_sessions"("user_id", "status", "expires_at");
CREATE INDEX "video_playback_sessions_video_asset_id_status_idx"
    ON "video_playback_sessions"("video_asset_id", "status");

ALTER TABLE "video_assets"
    ADD CONSTRAINT "video_assets_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "video_assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "video_playback_sessions"
    ADD CONSTRAINT "video_playback_sessions_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "video_playback_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "video_playback_sessions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
