-- Jajak pendapat pada postingan komunitas.
--
-- Polling bukan jenis postingan tersendiri: ia menempel pada postingan yang
-- sudah ada, sehingga badan tulisan, balasan, dan reaksinya tetap berlaku.
--
-- `community_poll_votes.poll_id` sengaja menyimpan ulang apa yang sebenarnya
-- dapat ditelusuri lewat `option_id`. Itulah yang membuat "satu suara per orang
-- per polling" ditegakkan basis data lewat UNIQUE, bukan dijaga kode aplikasi
-- yang akan kalah oleh dua permintaan yang tiba bersamaan.

CREATE TABLE "community_polls" (
  "id"         UUID NOT NULL,
  "post_id"    UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_polls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_polls_post_id_key" ON "community_polls"("post_id");

CREATE TABLE "community_poll_options" (
  "id"       UUID NOT NULL,
  "poll_id"  UUID NOT NULL,
  "label"    TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "community_poll_options_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_poll_options_poll_id_position_idx" ON "community_poll_options"("poll_id", "position");

CREATE TABLE "community_poll_votes" (
  "id"         UUID NOT NULL,
  "poll_id"    UUID NOT NULL,
  "option_id"  UUID NOT NULL,
  "user_id"    UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_poll_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_poll_votes_poll_id_user_id_key" ON "community_poll_votes"("poll_id", "user_id");
CREATE INDEX "community_poll_votes_option_id_idx" ON "community_poll_votes"("option_id");

ALTER TABLE "community_polls" ADD CONSTRAINT "community_polls_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_poll_options" ADD CONSTRAINT "community_poll_options_poll_id_fkey"
  FOREIGN KEY ("poll_id") REFERENCES "community_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_poll_votes" ADD CONSTRAINT "community_poll_votes_poll_id_fkey"
  FOREIGN KEY ("poll_id") REFERENCES "community_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_poll_votes" ADD CONSTRAINT "community_poll_votes_option_id_fkey"
  FOREIGN KEY ("option_id") REFERENCES "community_poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_poll_votes" ADD CONSTRAINT "community_poll_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
