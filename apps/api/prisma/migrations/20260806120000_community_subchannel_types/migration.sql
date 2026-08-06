CREATE TYPE "CommunityChannelType" AS ENUM ('CHAT', 'POSTS', 'ANNOUNCEMENTS');

ALTER TABLE "community_channels"
ADD COLUMN "type" "CommunityChannelType" NOT NULL DEFAULT 'CHAT';
