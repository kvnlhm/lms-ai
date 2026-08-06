ALTER TABLE "community_posts" ADD COLUMN "checklist_title" TEXT;

-- Baris pertama isi lama menjadi judul, sementara body dipertahankan utuh agar
-- migration tidak membuang konten yang sudah ditulis sebelum field ini ada.
UPDATE "community_posts" AS post
SET "checklist_title" = LEFT(COALESCE(NULLIF(split_part(post."body", E'\n', 1), ''), 'Checklist'), 160)
FROM "community_channels" AS channel
WHERE post."channel_id" = channel."id"
  AND channel."type" = 'CHECKLIST';
