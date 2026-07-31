-- Indeks untuk kueri penjadwal pengumuman.
--
-- Penjadwal mencari `status = 'PUBLISHED' AND notified_at IS NULL AND
-- published_at <= now()` pada setiap siklus. Tanpa indeks ini, kueri itu
-- memindai seluruh tabel setiap menit.
--
-- Indeksnya sudah dinyatakan di schema.prisma bersama kolom `notified_at`,
-- tetapi migrasinya terlewat — ketahuan oleh pemeriksaan drift.

-- CreateIndex
CREATE INDEX "announcements_status_notified_at_published_at_idx"
  ON "announcements"("status", "notified_at", "published_at");
