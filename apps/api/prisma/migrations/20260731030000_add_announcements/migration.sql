-- Pengumuman sesuai PRD 7.13, beserta nilai notifikasi untuk
-- trigger "Pengumuman baru" pada PRD 7.14.
--
-- Empat ALTER TABLE ... DROP DEFAULT yang juga diusulkan
-- prisma migrate diff sengaja tidak disertakan: drift lama, tidak
-- berkaitan dengan fitur ini.


-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL_USERS', 'COURSE_LEARNERS', 'SPECIFIC_USERS');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ANNOUNCEMENT_PUBLISHED';

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL_USERS',
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "course_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_targets" (
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "announcement_targets_pkey" PRIMARY KEY ("announcement_id","user_id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("announcement_id","user_id")
);

-- CreateIndex
CREATE INDEX "announcements_status_published_at_ends_at_idx" ON "announcements"("status", "published_at", "ends_at");

-- CreateIndex
CREATE INDEX "announcement_targets_user_id_idx" ON "announcement_targets"("user_id");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_targets" ADD CONSTRAINT "announcement_targets_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_targets" ADD CONSTRAINT "announcement_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

