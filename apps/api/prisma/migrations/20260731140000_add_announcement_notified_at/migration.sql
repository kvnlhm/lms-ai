-- Penanda bahwa penerima pengumuman sudah diberi tahu.
--
-- Pengumuman terjadwal diberitahukan oleh pekerjaan latar, bukan oleh tindakan
-- menerbitkan. Tanpa penanda ini, setiap siklus penjadwal akan mengirim
-- notifikasi yang sama berulang kali.

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN "notified_at" TIMESTAMPTZ(6);

-- Pengumuman yang sudah tampil sebelum kolom ini ada sudah diberitahukan pada
-- saat penerbitannya. Tanpa backfill ini, siklus pertama penjadwal akan
-- mengirim ulang notifikasi untuk seluruh riwayat pengumuman sekaligus.
UPDATE "announcements"
SET "notified_at" = COALESCE("published_at", "created_at")
WHERE "status" = 'PUBLISHED'
  AND "published_at" IS NOT NULL
  AND "published_at" <= now();
