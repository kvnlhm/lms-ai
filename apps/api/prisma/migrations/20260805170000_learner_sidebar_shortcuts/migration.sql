ALTER TABLE "community_channel_groups"
  ADD COLUMN "show_in_sidebar" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "community_channels"
  ADD COLUMN "show_in_sidebar" BOOLEAN NOT NULL DEFAULT true;
