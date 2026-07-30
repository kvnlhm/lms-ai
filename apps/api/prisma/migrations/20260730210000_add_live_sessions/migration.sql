-- Sesi belajar langsung dengan tautan yang ditempel Master (ADR-019).
--
-- Empat ALTER TABLE ... DROP DEFAULT pada tabel commerce yang juga
-- diusulkan prisma migrate diff sengaja tidak disertakan: itu drift lama
-- yang tidak berkaitan dengan fitur ini.
-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "join_url" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_by" UUID NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_sessions_course_id_starts_at_idx" ON "live_sessions"("course_id", "starts_at");

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

