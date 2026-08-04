import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiEnvelopeArray, ApiErrors } from '../../../shared/http/api-envelope';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../identity/presentation/decorators';
import { LiveSessionService } from '../application/live-session.service';
import {
  AdminLiveSessionDto,
  CreateLiveSessionDto,
  LearnerLiveSessionDto,
  ListLiveSessionQueryDto,
  UpdateLiveSessionDto,
} from './live-session.dto';

@ApiTags('live-sessions')
@Controller()
export class LiveSessionController {
  constructor(private readonly sessions: LiveSessionService) {}

  @Get('learn/courses/:courseId/live-sessions')
  @ApiOperation({ summary: 'Jadwal sesi langsung pada kursus yang diikuti' })
  @ApiEnvelopeArray(LearnerLiveSessionDto)
  @ApiErrors(401, 403, 404)
  forLearner(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.forLearner(user.id, courseId);
  }

  @Get('admin/live-sessions')
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Seluruh sesi langsung, termasuk yang dibatalkan' })
  @ApiEnvelopeArray(AdminLiveSessionDto)
  @ApiErrors(401, 403)
  list(@Query() query: ListLiveSessionQueryDto) {
    return this.sessions.list(query.courseId);
  }

  @Post('admin/live-sessions')
  @HttpCode(201)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Menjadwalkan sesi langsung' })
  @ApiEnvelope(AdminLiveSessionDto)
  @ApiErrors(401, 403, 422)
  create(@Body() dto: CreateLiveSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.create(
      {
        courseId: dto.courseId,
        title: dto.title,
        description: dto.description,
        joinUrl: dto.joinUrl,
        startsAt: new Date(dto.startsAt),
        durationMinutes: dto.durationMinutes,
      },
      user.id,
    );
  }

  @Patch('admin/live-sessions/:sessionId')
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Mengubah jadwal atau tautan sesi' })
  @ApiEnvelope(AdminLiveSessionDto)
  @ApiErrors(401, 403, 404, 422)
  update(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: UpdateLiveSessionDto,
  ) {
    return this.sessions.update(sessionId, {
      title: dto.title,
      description: dto.description,
      joinUrl: dto.joinUrl,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      durationMinutes: dto.durationMinutes,
    });
  }

  @Delete('admin/live-sessions/:sessionId')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @ApiOperation({ summary: 'Membatalkan sesi' })
  @ApiErrors(401, 403, 404)
  cancel(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.sessions.cancel(sessionId);
  }
}
