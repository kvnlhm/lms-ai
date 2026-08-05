-- Versi singkat hierarki sempat mengizinkan Channel induk tanpa ruang chat.
-- Penuhi invariant baru untuk data yang terlanjur dibuat sebelum form atomik.
INSERT INTO "community_channels" (
  "id", "group_id", "slug", "name", "description", "position",
  "is_read_only", "show_in_sidebar", "created_by", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), parent."id", 'umum', 'Umum', 'Percakapan umum', 0,
  false, parent."show_in_sidebar", parent."created_by", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "community_channel_groups" AS parent
WHERE NOT EXISTS (
  SELECT 1 FROM "community_channels" AS sub WHERE sub."group_id" = parent."id"
);
