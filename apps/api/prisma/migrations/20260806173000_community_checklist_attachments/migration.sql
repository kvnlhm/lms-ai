CREATE TABLE "community_post_attachments" (
  "id" UUID NOT NULL,
  "post_id" UUID NOT NULL,
  "object_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "community_post_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_post_attachments_post_id_key" ON "community_post_attachments"("post_id");
CREATE UNIQUE INDEX "community_post_attachments_object_key_key" ON "community_post_attachments"("object_key");
ALTER TABLE "community_post_attachments" ADD CONSTRAINT "community_post_attachments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
