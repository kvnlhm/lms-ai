ALTER TYPE "CommunityChannelType" ADD VALUE IF NOT EXISTS 'CHECKLIST';

ALTER TABLE "community_channels"
ADD COLUMN "allow_replies" BOOLEAN NOT NULL DEFAULT true;

UPDATE "community_channels"
SET "allow_replies" = false
WHERE "type" = 'ANNOUNCEMENTS';
