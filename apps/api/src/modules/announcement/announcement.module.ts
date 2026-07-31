import { Module } from '@nestjs/common';
import { AnnouncementScheduler } from './application/announcement-scheduler.service';
import { AnnouncementService } from './application/announcement.service';
import { AnnouncementController } from './presentation/announcement.controller';

@Module({
  controllers: [AnnouncementController],
  providers: [AnnouncementService, AnnouncementScheduler],
  exports: [AnnouncementScheduler],
})
export class AnnouncementModule {}
