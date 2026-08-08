-- Akses berbayar yang diberikan Master di luar Midtrans (ADR-032).
--
-- Tabel baru, tanpa backfill: akun yang sudah memiliki pesanan PAID tetap
-- terbaca sebagai anggota berbayar dari tabel pesanan, jadi tidak ada satu pun
-- baris yang perlu dipindahkan ke sini.
CREATE TABLE "manual_access_grants" (
    "user_id" UUID NOT NULL,
    "granted_until" TIMESTAMPTZ(6),
    "reason" TEXT,
    "granted_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "manual_access_grants_pkey" PRIMARY KEY ("user_id")
);

-- Dipakai saat menyaring grant yang sudah kedaluwarsa.
CREATE INDEX "manual_access_grants_granted_until_idx" ON "manual_access_grants"("granted_until");

ALTER TABLE "manual_access_grants"
    ADD CONSTRAINT "manual_access_grants_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pemberinya ditahan dengan RESTRICT: catatan siapa yang memberi akses tidak
-- boleh ikut lenyap ketika akun pemberinya dihapus.
ALTER TABLE "manual_access_grants"
    ADD CONSTRAINT "manual_access_grants_granted_by_fkey"
    FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Akun gratis menonton pelajaran pratinjau tanpa memiliki enrollment, sehingga
-- sesi playback tidak selalu dapat menunjuk salah satu. Sesinya tetap tercatat
-- atas nama penggunanya, jadi pembatasan perangkat dan masa berlaku tetap utuh.
--
-- Melonggarkan NOT NULL tidak menyentuh satu pun baris yang sudah ada.
ALTER TABLE "video_playback_sessions" ALTER COLUMN "enrollment_id" DROP NOT NULL;
