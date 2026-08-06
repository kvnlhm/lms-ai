ALTER TABLE "forum_replies"
ADD COLUMN "parent_reply_id" UUID;

ALTER TABLE "forum_replies"
ADD CONSTRAINT "forum_replies_parent_reply_id_fkey"
FOREIGN KEY ("parent_reply_id") REFERENCES "forum_replies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "forum_replies_parent_reply_id_created_at_idx"
ON "forum_replies"("parent_reply_id", "created_at");
