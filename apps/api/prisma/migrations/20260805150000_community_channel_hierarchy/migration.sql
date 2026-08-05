-- Channel lama langsung merupakan ruang chat. Kini setiap channel menjadi
-- kelompok dan ruang chat lamanya dipertahankan sebagai sub-channel "Umum".
-- ID community_channels tidak berubah, sehingga seluruh post tetap terhubung.

CREATE TABLE "community_channel_groups" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_by" UUID NOT NULL,
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "community_channel_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_channel_groups_slug_key" ON "community_channel_groups"("slug");
CREATE INDEX "community_channel_groups_archived_at_position_idx" ON "community_channel_groups"("archived_at", "position");

ALTER TABLE "community_channel_groups"
  ADD CONSTRAINT "community_channel_groups_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "community_channels" ADD COLUMN "group_id" UUID;

INSERT INTO "community_channel_groups" (
  "id", "slug", "name", "description", "position", "created_by", "archived_at", "created_at", "updated_at"
)
SELECT gen_random_uuid(), "slug", "name", "description", "position", "created_by", "archived_at", "created_at", "updated_at"
FROM "community_channels";

UPDATE "community_channels" AS sub
SET "group_id" = parent."id",
    "slug" = 'umum',
    "name" = 'Umum',
    "description" = COALESCE(sub."description", 'Percakapan umum'),
    "position" = 0
FROM "community_channel_groups" AS parent
WHERE parent."slug" = sub."slug";

ALTER TABLE "community_channels" ALTER COLUMN "group_id" SET NOT NULL;
DROP INDEX "community_channels_slug_key";
CREATE UNIQUE INDEX "community_channels_group_id_slug_key" ON "community_channels"("group_id", "slug");

ALTER TABLE "community_channels"
  ADD CONSTRAINT "community_channels_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "community_channel_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
