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
    // Disediakan sebagai larik agar modul lain dapat menyusul menjadi pemulih
    // tanpa mengubah penyapunya. Video satu-satunya untuk saat ini: hanya ia
    // yang mencatat unggahan yang sedang berjalan sebagai baris tersendiri.
    {
      provide: STALE_UPLOAD_RECONCILER,
      useFactory: (video: VideoService) => [video],
      inject: [VideoService],
    },
  ],
  exports: [LESSON_VIDEO_CLEANUP, STALE_UPLOAD_RECONCILER],
})
export class VideoModule {}
