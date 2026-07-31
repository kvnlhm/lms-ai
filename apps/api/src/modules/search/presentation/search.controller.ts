import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeArray, ApiErrors } from '../../../shared/http/api-envelope';
import { RateLimit } from '../../../shared/http/rate-limit.decorator';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser } from '../../identity/presentation/decorators';
import { type SearchType, SearchService } from '../application/search.service';
import { SearchGroupDto, SearchQueryDto } from './search.dto';

@ApiTags('search')
@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  // Satu permintaan menjalankan lima kueri; jatahnya dipisah dari menjelajah
  // biasa supaya pencarian tidak dapat dipakai menghabiskan anggaran umum.
  @RateLimit(60, 60)
  @ApiOperation({ summary: 'Mencari lintas pengguna, kursus, materi, forum, dan pengumuman' })
  @ApiEnvelopeArray(SearchGroupDto)
  @ApiErrors(401, 422)
  run(@Query() query: SearchQueryDto, @CurrentUser() user: AuthenticatedUser) {
    // Cakupan ditentukan dari permission pada session, bukan dari parameter —
    // klien tidak pernah dapat meminta melihat lebih banyak.
    return this.search.search(
      { id: user.id, permissions: user.permissions },
      query.q,
      // Aman disempitkan: `@IsIn` pada DTO sudah menolak nilai di luar daftar
      // sebelum sampai ke sini.
      query.types as SearchType[] | undefined,
      query.limit,
    );
  }
}
