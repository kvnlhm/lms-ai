import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../../../../shared/http/api-envelope';
import { LearnCourseResponseDto, LearnLessonResponseDto } from '../dto/learn.response';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser } from '../../../identity/presentation/decorators';
import { LearningDeliveryService } from '../../application/learning-delivery.service';

@ApiTags('learning-delivery')
@Controller('learn')
export class LearnController {
  constructor(private readonly delivery: LearningDeliveryService) {}

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
}
