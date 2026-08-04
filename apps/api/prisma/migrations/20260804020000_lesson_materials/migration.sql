-- Berkas materi yang diunggah Master dan disajikan terlindungi.
--
-- Sebelumnya jenis pelajaran PDF hanya dapat menunjuk `external_url`, sehingga
-- satu-satunya cara memberi dokumen adalah menaruhnya di layanan lain dengan
-- tautan yang dapat disalin siapa pun. Berkas di sini tidak pernah punya URL
-- publik: penyajiannya melewati pemeriksaan hak seperti video.
CREATE TABLE "lesson_materials" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "lesson_materials_pkey" PRIMARY KEY ("id")
);

-- Satu berkas per pelajaran: jenis PDF menjelaskan satu dokumen, dan membiarkan
-- banyak baris hanya menimbulkan pertanyaan "yang mana yang dibuka".
CREATE UNIQUE INDEX "lesson_materials_lesson_id_key" ON "lesson_materials"("lesson_id");
CREATE UNIQUE INDEX "lesson_materials_object_key_key" ON "lesson_materials"("object_key");

ALTER TABLE "lesson_materials" ADD CONSTRAINT "lesson_materials_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_materials" ADD CONSTRAINT "lesson_materials_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
