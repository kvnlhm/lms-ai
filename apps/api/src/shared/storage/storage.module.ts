import { Module } from '@nestjs/common';
import { CommunityModule } from '../../modules/community/community.module';
import { CommunityAttachmentService } from '../../modules/community/application/community-attachment.service';
import { VideoModule } from '../../modules/video/video.module';
import { VideoService } from '../../modules/video/application/video.service';
import { StaleUploadSweeper } from './stale-upload-sweeper.service';
import { STALE_UPLOAD_RECONCILER } from './stale-upload.port';

/**
 * Perawatan penyimpanan berkas yang tidak dimiliki satu modul pun.
 *
 * Berkas `.uploading` dapat tertinggal di direktori milik beberapa modul
 * berbeda, sehingga penyapunya tidak wajar tinggal di salah satunya. Modul-modul
 * itu diimpor semata untuk memperoleh pemulih basis datanya: penyapu ini tidak
 * pernah menyentuh tabel modul lain, hanya memanggil port yang modul itu sendiri
 * sediakan.
 *
 * Lariknya disusun di sini, bukan di modul masing-masing. Token yang sama
 * disediakan dua modul tidak bergabung menjadi satu larik — yang belakangan
 * menimpa yang duluan, dan penyapu kehilangan salah satu pemulihnya tanpa satu
 * pun galat.
 */
@Module({
  imports: [VideoModule, CommunityModule],
  providers: [
    StaleUploadSweeper,
    {
      provide: STALE_UPLOAD_RECONCILER,
      useFactory: (video: VideoService, community: CommunityAttachmentService) => [video, community],
      inject: [VideoService, CommunityAttachmentService],
    },
  ],
  exports: [StaleUploadSweeper],
})
export class StorageModule {}
