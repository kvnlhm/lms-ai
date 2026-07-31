-- Pemantauan galat runtime (PRD 12.7).
--
-- Satu baris per jenis galat, bukan per kejadian: `fingerprint` unik menjaga
-- galat berulang tetap satu baris dengan `occurrences` yang bertambah.

-- CreateEnum
CREATE TYPE "ErrorSource" AS ENUM ('API', 'WEB', 'WORKER');

-- CreateEnum
CREATE TYPE "ErrorStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "error_events" (
    "id" BIGSERIAL NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" "ErrorSource" NOT NULL,
    "status" "ErrorStatus" NOT NULL DEFAULT 'OPEN',
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "alerted_at" TIMESTAMPTZ(6),

    CONSTRAINT "error_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "error_events_fingerprint_key" ON "error_events"("fingerprint");

-- CreateIndex
CREATE INDEX "error_events_status_last_seen_at_idx" ON "error_events"("status", "last_seen_at");

-- CreateIndex
CREATE INDEX "error_events_source_last_seen_at_idx" ON "error_events"("source", "last_seen_at");

-- AddForeignKey
-- SET NULL, bukan CASCADE: menghapus akun Master tidak boleh ikut menghapus
-- riwayat galat yang kebetulan ditutup olehnya.
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
