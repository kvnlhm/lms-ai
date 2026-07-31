import { Module } from '@nestjs/common';
import { AnnouncementService } from './application/announcement.service';
import { AnnouncementController } from './presentation/announcement.controller';

@Module({
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
})
export class AnnouncementModule {}
