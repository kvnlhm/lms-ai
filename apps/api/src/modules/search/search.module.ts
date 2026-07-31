import { Module } from '@nestjs/common';
import { AnnouncementModule } from '../announcement/announcement.module';
import { SearchService } from './application/search.service';
import { SearchController } from './presentation/search.controller';

/**
 * Pencarian global (PRD 10).
 *
 * `AnnouncementModule` diimpor supaya aturan kelayakan pengumuman datang dari
 * pemiliknya, bukan disalin ke sini.
 */
@Module({
  imports: [AnnouncementModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
