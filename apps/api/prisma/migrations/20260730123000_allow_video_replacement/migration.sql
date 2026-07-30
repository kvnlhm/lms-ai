DROP INDEX IF EXISTS "video_assets_one_live_per_lesson";

-- Satu video yang sudah tervalidasi tetap aktif selama penggantinya diunggah.
CREATE UNIQUE INDEX "video_assets_one_available_per_lesson"
    ON "video_assets"("lesson_id")
    WHERE "deleted_at" IS NULL AND "status" = 'AVAILABLE';

-- Cegah dua upload bersamaan untuk lesson yang sama tanpa memblokir video aktif.
CREATE UNIQUE INDEX "video_assets_one_pending_per_lesson"
    ON "video_assets"("lesson_id")
    WHERE "deleted_at" IS NULL AND "status" IN ('CREATED', 'UPLOADING', 'PROCESSING');
