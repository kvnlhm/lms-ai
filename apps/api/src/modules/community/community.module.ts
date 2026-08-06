import { Module } from '@nestjs/common';
import { CommunityService } from './application/community.service';
import { CommunityAdminController } from './presentation/community-admin.controller';
import { CommunityController } from './presentation/community.controller';
import { CommunityAttachmentService } from './application/community-attachment.service';

@Module({ controllers: [CommunityController, CommunityAdminController], providers: [CommunityService, CommunityAttachmentService] })
export class CommunityModule {}
