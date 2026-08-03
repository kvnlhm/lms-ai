import { Module } from '@nestjs/common';
import { CommunityService } from './application/community.service';
import { CommunityAdminController } from './presentation/community-admin.controller';
import { CommunityController } from './presentation/community.controller';

@Module({ controllers: [CommunityController, CommunityAdminController], providers: [CommunityService] })
export class CommunityModule {}
