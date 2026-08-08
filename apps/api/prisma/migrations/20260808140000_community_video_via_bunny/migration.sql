-- Lampiran video kini dititipkan ke Bunny Stream, jadi tidak semua lampiran
-- punya berkas di volume kita. UNIQUE tetap dipertahankan: PostgreSQL
-- mengizinkan banyak NULL pada indeks unik, sehingga lampiran video tidak
-- saling bertabrakan.
ALTER TABLE "community_post_attachments" ALTER COLUMN "object_key" DROP NOT NULL;

ALTER TABLE "community_post_attachments" ADD COLUMN "video_asset_id" UUID;

-- `RESTRICT`, bukan `CASCADE`: menghapus aset video tidak boleh diam-diam
-- melenyapkan lampiran beserta postingannya. Lampirannya harus dilepas lebih
-- dulu, dan itu memang yang dilakukan jalur penghapusan lampiran.
ALTER TABLE "community_post_attachments"
  ADD CONSTRAINT "community_post_attachments_video_asset_id_fkey"
  FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "community_post_attachments_video_asset_id_idx"
  ON "community_post_attachments"("video_asset_id");

-- Tepat satu sumber isi per lampiran: berkas milik kita, atau aset video di
-- penyedia luar. Tanpa ini sebuah baris dapat menunjuk keduanya sekaligus atau
-- tidak menunjuk apa pun, dan penyaji tidak punya cara memilih.
ALTER TABLE "community_post_attachments"
  ADD CONSTRAINT "community_post_attachments_satu_sumber"
  CHECK (("object_key" IS NOT NULL) <> ("video_asset_id" IS NOT NULL));
