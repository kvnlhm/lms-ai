import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LESSON_VIDEO_CLEANUP } from '../learning-catalog/application/lesson-video-cleanup.port';
import { VideoService } from './application/video.service';
import { BunnyStreamClient } from './infrastructure/bunny-stream.client';
import { VideoController } from './presentation/video.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [VideoController],
  providers: [
    VideoService,
    BunnyStreamClient,
    { provide: LESSON_VIDEO_CLEANUP, useExisting: VideoService },
  ],
  exports: [LESSON_VIDEO_CLEANUP],
})
export class VideoModule {}
