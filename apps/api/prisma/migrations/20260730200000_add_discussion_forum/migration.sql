-- Forum diskusi sesuai PRD 7.12, plus pencabutan hak berpartisipasi
-- (forum_bans) yang diminta di luar PRD dan dicatat pada ADR-018.
--
-- Catatan: prisma migrate diff juga mengusulkan empat ALTER TABLE
-- ... DROP DEFAULT pada tabel commerce. Itu drift lama yang tidak
-- berkaitan dengan forum, jadi sengaja tidak disertakan di sini.

-- CreateEnum
CREATE TYPE "ForumTopicStatus" AS ENUM ('OPEN', 'RESOLVED', 'LOCKED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ForumReportStatus" AS ENUM ('PENDING', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "forum_topics" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "module_id" UUID,
    "lesson_id" UUID,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ForumTopicStatus" NOT NULL DEFAULT 'OPEN',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "best_reply_id" UUID,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderated_by" UUID,
    "moderated_at" TIMESTAMPTZ(6),
    "moderation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_replies" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "moderated_by" UUID,
    "moderated_at" TIMESTAMPTZ(6),
    "moderation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "topic_id" UUID,
    "reply_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "topic_id" UUID,
    "reply_id" UUID,
    "reason" TEXT NOT NULL,
    "status" "ForumReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_bans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID,
    "reason" TEXT NOT NULL,
    "issued_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_bans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forum_topics_best_reply_id_key" ON "forum_topics"("best_reply_id");

-- CreateIndex
CREATE INDEX "forum_topics_course_id_status_is_pinned_last_activity_at_idx" ON "forum_topics"("course_id", "status", "is_pinned", "last_activity_at");

-- CreateIndex
CREATE INDEX "forum_topics_lesson_id_idx" ON "forum_topics"("lesson_id");

-- CreateIndex
CREATE INDEX "forum_topics_author_id_idx" ON "forum_topics"("author_id");

-- CreateIndex
CREATE INDEX "forum_replies_topic_id_created_at_idx" ON "forum_replies"("topic_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_replies_author_id_idx" ON "forum_replies"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reactions_user_id_topic_id_key" ON "forum_reactions"("user_id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reactions_user_id_reply_id_key" ON "forum_reactions"("user_id", "reply_id");

-- CreateIndex
CREATE INDEX "forum_reports_status_created_at_idx" ON "forum_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "forum_bans_user_id_revoked_at_idx" ON "forum_bans"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "forum_bans_course_id_revoked_at_idx" ON "forum_bans"("course_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_best_reply_id_fkey" FOREIGN KEY ("best_reply_id") REFERENCES "forum_replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_bans" ADD CONSTRAINT "forum_bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_bans" ADD CONSTRAINT "forum_bans_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_bans" ADD CONSTRAINT "forum_bans_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

