ALTER TABLE "community_channels"
DROP CONSTRAINT "community_channels_group_id_fkey",
ADD CONSTRAINT "community_channels_group_id_fkey"
FOREIGN KEY ("group_id") REFERENCES "community_channel_groups"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_checklist_completions" (
  "post_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_checklist_completions_pkey" PRIMARY KEY ("post_id", "user_id")
);

CREATE INDEX "community_checklist_completions_user_id_idx"
ON "community_checklist_completions"("user_id");

ALTER TABLE "community_checklist_completions"
ADD CONSTRAINT "community_checklist_completions_post_id_fkey"
FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_checklist_completions"
ADD CONSTRAINT "community_checklist_completions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
