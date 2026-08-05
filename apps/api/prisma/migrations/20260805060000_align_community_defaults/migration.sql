-- Menyelaraskan database dengan schema.prisma, untuk kedua kalinya.
--
-- Drift yang sama persis pernah ditutup pada 20260731150000_align_column_defaults
-- untuk tabel commerce. Migrasi community tanggal 3 Agustus mengulanginya:
-- tiga kolom `id` ditulis tangan dengan `DEFAULT gen_random_uuid()`, sementara
-- schema hanya menyatakan `@default(uuid())` — yang diisi Prisma dari sisi
-- klien, bukan oleh database.
--
-- Arahnya tetap mengikuti schema, bukan sebaliknya: schema adalah sumber
-- kebenaran (AGENTS.md §3), dan tidak satu pun dari ~30 tabel lain memakai
-- default database untuk kolom id.
--
-- Aman: seluruh penulisan ke ketiga tabel ini lewat Prisma, yang selalu
-- mengirim id. Tidak ada satu pun INSERT mentah ke tabel community.
--
-- Butir keempat berbeda sifatnya. Nama indeks di migrasi aslinya 65 karakter,
-- dan PostgreSQL memotong diam-diam pada 63 — menjadi `..._last_activity_i`,
-- dengan akhiran `_idx` ikut terpotong. Prisma memotongnya dengan cara lain:
-- ia mempertahankan `_idx` di ujung. Jadi indeksnya ada dan bekerja, tetapi
-- namanya bukan nama yang dicari schema, dan selisih itu muncul pada setiap
-- `migrate diff` sesudahnya. Yang diganti hanya namanya; kolom, urutan, dan
-- perilaku indeksnya tidak tersentuh.

-- AlterTable
ALTER TABLE "community_channels" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "community_posts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "community_comments" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "community_posts_channel_id_deleted_at_is_pinned_last_activity_i" RENAME TO "community_posts_channel_id_deleted_at_is_pinned_last_activi_idx";
