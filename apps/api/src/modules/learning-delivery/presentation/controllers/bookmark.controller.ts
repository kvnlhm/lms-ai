import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiEnvelopeArray, ApiErrors } from '../../../../shared/http/api-envelope';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser } from '../../../identity/presentation/decorators';
import { BookmarkService } from '../../application/bookmark.service';
import { BookmarkDto, BookmarkStateDto, SaveBookmarkDto } from '../dto/bookmark.dto';

@ApiTags('bookmarks')
@Controller()
export class BookmarkController {
  constructor(private readonly bookmarks: BookmarkService) {}

  @Get('me/bookmarks')
  @ApiOperation({ summary: 'Materi yang kutandai untuk dibuka kembali' })
  @ApiEnvelopeArray(BookmarkDto)
  @ApiErrors(401)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.bookmarks.list(user.id);
  }

  // PUT, bukan POST: menandai materi yang sama dua kali harus menghasilkan
  // keadaan yang sama, bukan galat duplikat.
  @Put('learn/lessons/:lessonId/bookmark')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menandai materi ini' })
  @ApiEnvelope(BookmarkStateDto)
  @ApiErrors(401, 403, 404, 422)
  add(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: SaveBookmarkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookmarks.add(user.id, lessonId, dto.note);
  }

  @Delete('learn/lessons/:lessonId/bookmark')
  @HttpCode(200)
  @ApiOperation({ summary: 'Melepas tanda dari materi ini' })
  @ApiEnvelope(BookmarkStateDto)
  @ApiErrors(401)
  remove(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookmarks.remove(user.id, lessonId);
  }
}
