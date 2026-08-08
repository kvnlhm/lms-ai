import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LESSON_VIDEO_CLEANUP } from '../learning-catalog/application/lesson-video-cleanup.port';
import { VideoService } from './application/video.service';
import { VideoProvisionerService } from './application/video-provisioner.service';
import { VIDEO_PROVISIONER } from './application/video-provisioning.port';
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
    VideoProvisionerService,
    { provide: VIDEO_PROVISIONER, useExisting: VideoProvisionerService },
  ],
  // `VideoService` diekspor sebagai pemulih unggahan terbengkalai. Lariknya
  // sendiri disusun `StorageModule`: sejak komunitas ikut menjadi pemulih,
  // menyediakan token itu di sini berarti dua modul menyediakan token yang sama
  // dan yang belakangan menimpa yang duluan alih-alih bergabung — penyapu akan
  // diam-diam kehilangan salah satunya.
  // `VIDEO_PROVISIONER` diekspor, bukan `BunnyStreamClient`: modul lain tidak
  // perlu — dan tidak boleh — tahu penyedia mana yang dipakai (ADR-013).
  exports: [LESSON_VIDEO_CLEANUP, VideoService, VIDEO_PROVISIONER],
})
export class VideoModule {}
