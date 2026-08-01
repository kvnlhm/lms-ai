-- Membalik arah relasi video: aset menjadi barang perpustakaan yang berdiri
-- sendiri, dan pelajaran yang menunjuk kepadanya.
--
-- Sebelum ini `video_assets.lesson_id` wajib, sehingga satu berkas secara
-- struktural hanya bisa dipakai satu pelajaran. Mengunggah materi yang sama ke
-- dua pelajaran berarti dua salinan di disk.
--
-- Urutannya penting: kolom baru diisi lebih dulu dari data lama, baru kolom
-- lama dibuang. Dengan begitu migrasi ini tidak pernah kehilangan tautan yang
-- sudah ada, dan dapat dijalankan pada database berisi.

-- 1. Kolom baru, keduanya masih boleh kosong selama backfill.
ALTER TABLE "lessons" ADD COLUMN "video_asset_id" UUID;
ALTER TABLE "video_playback_sessions" ADD COLUMN "lesson_id" UUID;

-- 2. Setiap pelajaran mengambil aset yang aktif untukmya sekarang. Indeks unik
--    parsial lama menjamin paling banyak ada satu yang AVAILABLE per pelajaran,
--    tetapi DISTINCT ON tetap dipakai supaya migrasi ini tidak bergantung pada
--    jaminan itu bila datanya ternyata lebih berantakan dari dugaan.
UPDATE "lessons" AS l
SET "video_asset_id" = pilihan."id"
FROM (
    SELECT DISTINCT ON ("lesson_id") "id", "lesson_id"
    FROM "video_assets"
    WHERE "status" = 'AVAILABLE' AND "deleted_at" IS NULL
    ORDER BY "lesson_id", "created_at" DESC
) AS pilihan
WHERE pilihan."lesson_id" = l."id";

-- 3. Sesi pemutaran mewarisi pelajaran dari asetnya. Ini benar untuk data lama
--    justru karena dulu satu aset hanya milik satu pelajaran.
UPDATE "video_playback_sessions" AS s
SET "lesson_id" = v."lesson_id"
FROM "video_assets" AS v
WHERE v."id" = s."video_asset_id";

-- 4. Sesi yang asetnya sudah lenyap tidak dapat diberi konteks pelajaran, dan
--    tanpa konteks itu haknya tidak dapat diperiksa. Dibuang, bukan dibiarkan
--    dengan kolom kosong.
DELETE FROM "video_playback_sessions" WHERE "lesson_id" IS NULL;
ALTER TABLE "video_playback_sessions" ALTER COLUMN "lesson_id" SET NOT NULL;

-- 5. Kunci asing dan indeks untuk bentuk yang baru.
ALTER TABLE "lessons"
    ADD CONSTRAINT "lessons_video_asset_id_fkey"
    FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "video_playback_sessions"
    ADD CONSTRAINT "video_playback_sessions_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "lessons_video_asset_id_idx" ON "lessons"("video_asset_id");
CREATE INDEX "video_playback_sessions_lesson_id_idx" ON "video_playback_sessions"("lesson_id");

-- 6. Bentuk lama dibuang.
--
--    Kedua indeks unik parsial ini menjaga "satu video aktif per pelajaran" dan
--    "satu upload berjalan per pelajaran". Yang pertama sekarang dijamin
--    struktur: `lessons.video_asset_id` hanya satu kolom. Yang kedua kehilangan
--    maknanya — unggahan masuk ke perpustakaan, bukan ke sebuah pelajaran, jadi
--    dua unggahan berbarengan adalah dua barang perpustakaan yang sah.
DROP INDEX IF EXISTS "video_assets_one_available_per_lesson";
DROP INDEX IF EXISTS "video_assets_one_pending_per_lesson";
DROP INDEX IF EXISTS "video_assets_lesson_id_status_idx";

ALTER TABLE "video_assets" DROP CONSTRAINT IF EXISTS "video_assets_lesson_id_fkey";
ALTER TABLE "video_assets" DROP COLUMN "lesson_id";

CREATE INDEX "video_assets_status_idx" ON "video_assets"("status");
