-- Penanda suntingan, terpisah dari `updated_at`.
--
-- `updated_at` pada post ikut berubah setiap kali reaksi atau jumlah balasan
-- dihitung ulang, sehingga tidak dapat dipakai untuk menjawab "apakah tulisan
-- ini pernah diubah". Kolom sendiri membuat jawabannya jujur.
ALTER TABLE "community_posts" ADD COLUMN "edited_at" TIMESTAMPTZ(6);
ALTER TABLE "community_comments" ADD COLUMN "edited_at" TIMESTAMPTZ(6);
