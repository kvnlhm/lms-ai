-- Notifikasi dalam aplikasi sesuai PRD 7.14 (channel MVP: in-app).
--
-- Empat ALTER TABLE ... DROP DEFAULT yang juga diusulkan
-- prisma migrate diff sengaja tidak disertakan: itu drift lama pada
-- tabel commerce dan notification_preferences, tidak berkaitan
-- dengan fitur ini.


-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ENROLLED_IN_COURSE', 'FORUM_REPLY', 'FORUM_BEST_ANSWER', 'FORUM_PARTICIPATION_REVOKED', 'FORUM_PARTICIPATION_RESTORED', 'COURSE_COMPLETED', 'LIVE_SESSION_SCHEDULED', 'FORUM_NEW_TOPIC', 'FORUM_CONTENT_REPORTED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

