-- Provider video baru: materi dapat menunjuk ke YouTube unlisted alih-alih
-- berkas yang diunggah ke server ini.
ALTER TYPE "VideoProvider" ADD VALUE 'YOUTUBE';

-- Video eksternal tidak punya berkas, sehingga metadata berkas menjadi opsional.
ALTER TABLE "video_assets" ALTER COLUMN "original_name" DROP NOT NULL;
ALTER TABLE "video_assets" ALTER COLUMN "mime_type" DROP NOT NULL;
ALTER TABLE "video_assets" ALTER COLUMN "size_bytes" DROP NOT NULL;

-- URL kanonis di penyedia eksternal.
ALTER TABLE "video_assets" ADD COLUMN "source_url" TEXT;
