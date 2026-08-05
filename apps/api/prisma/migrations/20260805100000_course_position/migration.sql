-- Urutan katalog yang ditentukan Master.
--
-- Sampai sekarang urutan kartu di /courses ditentukan mesin: terbit terbaru
-- dulu, lalu abjad. Master tidak punya cara apa pun untuk menaruh kursus
-- pembuka di depan, dan kursus yang paling penting bisa terdorong ke halaman
-- dua hanya karena kursus lain terbit belakangan.
--
-- Kolomnya diisi mundur dengan urutan yang berlaku hari ini, bukan dengan nol
-- semua. Tanpa itu, migrasi ini akan mengacak katalog yang sedang dilihat
-- pelajar pada detik ia dijalankan — perubahan yang tidak diminta siapa pun.
-- Sesudah migrasi ini katalog terlihat persis sama seperti sebelumnya; yang
-- berubah hanya urutannya kini dapat disunting.

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill: pertahankan urutan yang sedang tampil.
--
-- NULLS LAST penting. Draf dan arsip belum pernah terbit, jadi published_at
-- mereka NULL; pada DESC PostgreSQL menaruh NULL di depan, sehingga tanpa ini
-- seluruh draf akan menempati urutan teratas katalog Master.
WITH urut AS (
  SELECT id, row_number() OVER (ORDER BY published_at DESC NULLS LAST, title ASC) AS n
  FROM "courses"
)
UPDATE "courses" c SET "position" = urut.n FROM urut WHERE c.id = urut.id;

-- CreateIndex
CREATE INDEX "courses_status_position_idx" ON "courses"("status", "position");
