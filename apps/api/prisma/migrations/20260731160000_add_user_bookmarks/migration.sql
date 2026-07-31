-- Bookmark materi (PRD 14, backlog P1).
--
-- Kunci utamanya gabungan user+lesson, jadi satu materi hanya dapat ditandai
-- sekali oleh orang yang sama tanpa perlu pemeriksaan tambahan di aplikasi.
--
-- CASCADE pada kedua sisi disengaja: bookmark bukan riwayat belajar. Menghapus
-- akun atau materi boleh ikut menghapusnya, tidak seperti `lesson_progress`
-- yang harus bertahan.

-- CreateTable
CREATE TABLE "user_bookmarks" (
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_bookmarks_pkey" PRIMARY KEY ("user_id","lesson_id")
);

-- CreateIndex
CREATE INDEX "user_bookmarks_user_id_created_at_idx" ON "user_bookmarks"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
