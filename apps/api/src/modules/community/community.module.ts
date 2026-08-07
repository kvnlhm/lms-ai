import { Module } from '@nestjs/common';
import { CommunityService } from './application/community.service';
import { CommunityAdminController } from './presentation/community-admin.controller';
import { CommunityController } from './presentation/community.controller';
import { CommunityAttachmentService } from './application/community-attachment.service';

@Module({
  controllers: [CommunityController, CommunityAdminController],
  providers: [CommunityService, CommunityAttachmentService],
  // Diekspor untuk `StorageModule`, yang menyusun larik pemulih unggahan
  // terbengkalai. Unggahan composer yang tidak pernah diterbitkan hanya dapat
  // dikenali lewat basis data, jadi penyapu berkas saja tidak menjangkaunya.
  exports: [CommunityAttachmentService],
})
export class CommunityModule {}
