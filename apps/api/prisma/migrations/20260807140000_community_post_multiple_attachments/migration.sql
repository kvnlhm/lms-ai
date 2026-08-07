-- Lampiran banyak per postingan.
--
-- Tiga perubahan, dan urutannya penting.
--
-- 1. `post_id` menjadi opsional. Composer mengunggah berkas sebelum
--    postingannya ada; baris tanpa `post_id` adalah unggahan yang masih
--    menunggu diterbitkan. Batasan UNIQUE ikut dibuang — itulah yang selama ini
--    mengunci satu lampiran per postingan.
-- 2. `uploader_id` ditambahkan supaya pengikatan saat publish dapat diperiksa
--    terhadap orang yang benar-benar mengunggahnya, dan supaya penyapu tahu
--    unggahan tergantung itu milik siapa. Diisi mundur dari penulis
--    postingannya, bukan dibiarkan kosong, agar baris lama tetap sah.
-- 3. `position` menyimpan urutan yang dipilih penulisnya. Tanpa kolom ini
--    urutan gambar akan mengikuti `created_at`, yang berarti berubah sendiri
--    setiap kali unggahan paralel selesai dengan kecepatan berbeda.

ALTER TABLE "community_post_attachments" DROP CONSTRAINT "community_post_attachments_post_id_fkey";
DROP INDEX IF EXISTS "community_post_attachments_post_id_key";

ALTER TABLE "community_post_attachments" ALTER COLUMN "post_id" DROP NOT NULL;
ALTER TABLE "community_post_attachments" ADD COLUMN "uploader_id" UUID;
ALTER TABLE "community_post_attachments" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "community_post_attachments" a
SET "uploader_id" = p."author_id"
FROM "community_posts" p
WHERE p."id" = a."post_id" AND a."uploader_id" IS NULL;

-- Baris yatim tidak mungkin ada — `post_id` masih NOT NULL sampai perintah di
-- atas — tetapi kalau toh ada, ia tidak punya pemilik yang dapat disebut dan
-- tidak boleh menahan migrasi.
DELETE FROM "community_post_attachments" WHERE "uploader_id" IS NULL;

ALTER TABLE "community_post_attachments" ALTER COLUMN "uploader_id" SET NOT NULL;

ALTER TABLE "community_post_attachments"
  ADD CONSTRAINT "community_post_attachments_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_post_attachments"
  ADD CONSTRAINT "community_post_attachments_uploader_id_fkey"
  FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "community_post_attachments_post_id_position_idx" ON "community_post_attachments"("post_id", "position");
CREATE INDEX "community_post_attachments_uploader_id_post_id_created_at_idx" ON "community_post_attachments"("uploader_id", "post_id", "created_at");
