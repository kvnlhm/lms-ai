import { Module } from '@nestjs/common';
import { VideoModule } from '../../modules/video/video.module';
import { StaleUploadSweeper } from './stale-upload-sweeper.service';

/**
 * Perawatan penyimpanan berkas yang tidak dimiliki satu modul pun.
 *
 * Berkas `.uploading` dapat tertinggal di direktori milik beberapa modul
 * berbeda, sehingga penyapunya tidak wajar tinggal di salah satunya. `VideoModule`
 * diimpor semata untuk memperoleh pemulih basis datanya: penyapu ini tidak
 * pernah menyentuh tabel modul lain, hanya memanggil port yang modul itu sendiri
 * sediakan.
 */
@Module({
  imports: [VideoModule],
  providers: [StaleUploadSweeper],
  exports: [StaleUploadSweeper],
})
export class StorageModule {}
