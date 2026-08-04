import { Controller, Get, Header, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../../../../shared/http/api-envelope';
import { LearnCourseResponseDto, LearnLessonResponseDto } from '../dto/learn.response';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser } from '../../../identity/presentation/decorators';
import { LearningDeliveryService } from '../../application/learning-delivery.service';
import { LessonMaterialService } from '../../../learning-catalog/application/lesson-material.service';
import type { Response } from 'express';

@ApiTags('learning-delivery')
@Controller('learn')
export class LearnController {
  constructor(
    private readonly delivery: LearningDeliveryService,
    private readonly materials: LessonMaterialService,
  ) {}

  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Kurikulum dan progres untuk kursus yang diikuti' })
  @ApiEnvelope(LearnCourseResponseDto)
  @ApiErrors(401, 403, 404)
  async course(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.delivery.course(user.id, courseId);
  }

  @Get('lessons/:lessonId')
  @ApiOperation({ summary: 'Isi satu pelajaran' })
  @ApiEnvelope(LearnLessonResponseDto)
  @ApiErrors(401, 403, 404)
  async lesson(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.delivery.lesson(user.id, lessonId);
  }

  /**
   * Menyajikan berkas materi pelajaran kepada pelajar yang berhak.
   *
   * Berkasnya tidak pernah punya URL publik: haknya diperiksa di sini, lalu
   * penyajiannya diserahkan ke reverse proxy lewat X-Accel-Redirect — pola yang
   * sama dengan video self-hosted. Mengetahui id pelajaran saja tidak cukup.
   */
  @Get('lessons/:lessonId/material')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Mengunduh materi pelajaran lewat reverse proxy' })
  @ApiErrors(401, 403, 404)
  async material(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const objectKey = await this.materials.authorisedObject(lessonId, user.id);
    response.setHeader('X-Accel-Redirect', `/protected-materials/${objectKey}`);
    response.setHeader('Content-Type', 'application/pdf');
    response.status(200).end();
  }
}
