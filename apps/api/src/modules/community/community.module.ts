import { Module } from '@nestjs/common';
import { VideoModule } from '../video/video.module';
import { CommerceModule } from '../commerce/commerce.module';
import { CommunityService } from './application/community.service';
import { CommunityAdminController } from './presentation/community-admin.controller';
import { CommunityController } from './presentation/community.controller';
import { CommunityAttachmentService } from './application/community-attachment.service';

@Module({
  // Diimpor untuk memperoleh `VIDEO_PROVISIONER`. Yang dipakai portnya,
  // bukan klien penyedianya; lihat ADR-013. `CommerceModule` menyusul untuk
  // `MEMBERSHIP_ACCESS`, dengan alasan yang sama (ADR-032).
  imports: [VideoModule, CommerceModule],
  controllers: [CommunityController, CommunityAdminController],
  providers: [CommunityService, CommunityAttachmentService],
  // Diekspor untuk `StorageModule`, yang menyusun larik pemulih unggahan
  // terbengkalai. Unggahan composer yang tidak pernah diterbitkan hanya dapat
  // dikenali lewat basis data, jadi penyapu berkas saja tidak menjangkaunya.
  exports: [CommunityAttachmentService],
})
export class CommunityModule {}
