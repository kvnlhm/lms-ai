import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { ForumModerationService } from './application/forum-moderation.service';
import { ForumService } from './application/forum.service';
import { ForumAdminController } from './presentation/forum-admin.controller';
import { ForumController } from './presentation/forum.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [ForumController, ForumAdminController],
  providers: [ForumService, ForumModerationService],
  exports: [ForumService],
})
export class ForumModule {}
