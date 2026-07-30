import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import type { Request, Response } from 'express';
import { ApiErrors } from '../../../shared/http/api-envelope';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../identity/presentation/decorators';
import { VideoService } from '../application/video.service';
import {
  CreatePlaybackSessionDto,
  CreateVideoUploadIntentDto,
  CreateYoutubeVideoDto,
} from './video.dto';

@ApiTags('video')
@Controller()
export class VideoController {
  constructor(private readonly videos: VideoService) {}

  @Post('admin/videos/upload-intents')
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Membuat intent upload video self-hosted' })
  @ApiErrors(401, 403, 404, 422)
  createIntent(@Body() dto: CreateVideoUploadIntentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.videos.createUploadIntent(dto, user.id);
  }

  @Post('admin/videos/youtube')
  @HttpCode(201)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Menautkan lesson ke video YouTube unlisted' })
  @ApiErrors(401, 403, 404, 422)
  createYoutube(@Body() dto: CreateYoutubeVideoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.videos.createYoutubeVideo(dto, user.id);
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
