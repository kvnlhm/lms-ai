import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import type { Request, Response } from 'express';
import { ApiEnvelope, ApiEnvelopeList, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../identity/presentation/decorators';
import { VideoService } from '../application/video.service';
import {
  AttachLessonVideoDto,
  CreateBunnyVideoDto,
  CreateBunnyVideoResultDto,
  CreatePlaybackSessionDto,
  CreateVideoUploadIntentDto,
  CreateYoutubeVideoDto,
  CreateYoutubeVideoResultDto,
  LessonVideoMutationDto,
  VideoUploadIntentResultDto,
  ListVideoLibraryQueryDto,
  PlaybackSessionDto,
  VideoLibraryItemDto,
  VideoLibrarySummaryDto,
} from './video.dto';

@ApiTags('video')
@Controller()
export class VideoController {
  constructor(private readonly videos: VideoService) {}

  @Post('admin/videos/upload-intents')
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Membuat intent upload video self-hosted' })
  @ApiEnvelope(VideoUploadIntentResultDto)
  @ApiErrors(401, 403, 404, 422)
  createIntent(@Body() dto: CreateVideoUploadIntentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.videos.createUploadIntent(dto, user.id);
  }

  @Post('admin/videos/youtube')
  @HttpCode(201)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Menambahkan video YouTube ke perpustakaan' })
  @ApiEnvelope(CreateYoutubeVideoResultDto)
  @ApiErrors(401, 403, 404, 422)
  createYoutube(@Body() dto: CreateYoutubeVideoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.videos.createYoutubeVideo(dto, user.id);
  }

  @Post('admin/videos/bunny')
  @HttpCode(201)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Mendaftarkan video Bunny Stream ke perpustakaan' })
  @ApiEnvelope(CreateBunnyVideoResultDto)
  @ApiErrors(401, 403, 422)
  createBunny(@Body() dto: CreateBunnyVideoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.videos.createBunnyVideo(dto, user.id);
  }

  @Get('admin/videos')
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Isi perpustakaan video beserta pemakaiannya' })
  @ApiEnvelopeList(VideoLibraryItemDto)
  @ApiErrors(401, 403)
  async library(@Query() query: ListVideoLibraryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, items } = await this.videos.listLibrary(
      { search: query.search, filter: query.filter },
      page,
      pageSize,
    );
    return new Paginated(items, page, pageSize, total);
  }

  @Get('admin/videos/summary')
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Jumlah dan besaran seluruh perpustakaan, bukan satu halaman' })
  @ApiEnvelope(VideoLibrarySummaryDto)
  @ApiErrors(401, 403)
  librarySummary() {
    return this.videos.librarySummary();
  }

  @Put('admin/lessons/:lessonId/video')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Memasang video perpustakaan pada sebuah pelajaran' })
  @ApiEnvelope(LessonVideoMutationDto)
  @ApiErrors(401, 403, 404, 422)
  attach(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: AttachLessonVideoDto,
  ) {
    return this.videos.attachToLesson(lessonId, dto.videoAssetId);
  }

  @Delete('admin/lessons/:lessonId/video')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Melepas video dari pelajaran tanpa menghapus berkasnya' })
  @ApiEnvelope(LessonVideoMutationDto)
  @ApiErrors(401, 403, 404)
  detach(@Param('lessonId', new ParseUUIDPipe()) lessonId: string) {
    return this.videos.detachFromLesson(lessonId);
  }

  @Delete('admin/videos/:videoAssetId')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Menghapus aset perpustakaan yang tidak dipakai pelajaran mana pun' })
  @ApiEnvelope(LessonVideoMutationDto)
  @ApiErrors(401, 403, 404, 422)
  destroy(@Param('videoAssetId', new ParseUUIDPipe()) videoAssetId: string) {
    return this.videos.deleteAsset(videoAssetId);
  }

  @Put('admin/videos/:videoAssetId/content')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Mengunggah body MP4 secara streaming' })
  @ApiErrors(401, 403, 404, 422)
  upload(
    @Param('videoAssetId', new ParseUUIDPipe()) videoAssetId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const rawLength = request.header('content-length');
    return this.videos.upload(
      videoAssetId,
      user.id,
      request,
      rawLength ? Number.parseInt(rawLength, 10) : undefined,
    );
  }

  @Post('learn/lessons/:lessonId/playback-sessions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat playback session setelah validasi akses lesson' })
  @ApiEnvelope(PlaybackSessionDto)
  @ApiErrors(401, 403, 404, 409)
  createPlayback(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: CreatePlaybackSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.videos.createPlaybackSession(lessonId, user.id, dto.deviceId);
  }

  @Get('playback-sessions/:playbackSessionId/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('Content-Disposition', 'inline')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Mengotorisasi internal media delivery oleh reverse proxy' })
  @ApiErrors(401, 403, 404)
  async content(
    @Param('playbackSessionId', new ParseUUIDPipe()) playbackSessionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const objectKey = await this.videos.authorisedObject(playbackSessionId, user.id);
    response.setHeader('X-Accel-Redirect', `/protected-videos/${objectKey}`);
    response.setHeader('Content-Type', 'video/mp4');
    response.status(200).end();
  }
}
