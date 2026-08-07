import { Module } from '@nestjs/common';
import { STALE_UPLOAD_RECONCILER } from '../../shared/storage/stale-upload.port';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LESSON_VIDEO_CLEANUP } from '../learning-catalog/application/lesson-video-cleanup.port';
import { VideoService } from './application/video.service';
import { BunnyPlaybackCheck } from './infrastructure/bunny-playback-check.service';
import { BunnyStreamClient } from './infrastructure/bunny-stream.client';
import { VideoController } from './presentation/video.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [VideoController],
  providers: [
    VideoService,
    BunnyStreamClient,
    BunnyPlaybackCheck,
    { provide: LESSON_VIDEO_CLEANUP, useExisting: VideoService },
  ],
  // `VideoService` diekspor sebagai pemulih unggahan terbengkalai. Lariknya
  // sendiri disusun `StorageModule`: sejak komunitas ikut menjadi pemulih,
  // menyediakan token itu di sini berarti dua modul menyediakan token yang sama
  // dan yang belakangan menimpa yang duluan alih-alih bergabung — penyapu akan
  // diam-diam kehilangan salah satunya.
  exports: [LESSON_VIDEO_CLEANUP, VideoService],
})
export class VideoModule {}
