import { Body, Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../../../shared/errors/app-error';
import { IdempotencyService } from '../../../../shared/idempotency/idempotency.service';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser } from '../../../identity/presentation/decorators';
import { LessonProgressService, type CompleteLessonResult } from '../../application/lesson-progress.service';
import { CompleteLessonDto, OpenLessonDto } from '../dto/complete-lesson.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('learning-progress')
@Controller('learn/lessons')
export class LessonProgressController {
  constructor(
    private readonly progress: LessonProgressService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post(':lessonId/open')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mencatat bahwa pelajaran dibuka' })
  async open(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: OpenLessonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.progress.open(user.id, lessonId, dto.sessionId);
  }

  @Post(':lessonId/complete')
  @HttpCode(200)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'UUID. Percobaan ulang dengan kunci dan isi yang sama mengembalikan respons pertama. ' +
      'Bila tidak dikirim, operasi tetap aman diulang karena penyelesaian pelajaran bersifat idempotent.',
  })
  @ApiOperation({ summary: 'Menandai pelajaran selesai' })
  async complete(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: CompleteLessonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CompleteLessonResult> {
    if (idempotencyKey !== undefined && !UUID_RE.test(idempotencyKey)) {
      throw AppError.validation({ 'Idempotency-Key': ['Idempotency-Key harus berupa UUID.'] });
    }

    const run = () =>
      this.progress.complete({
        userId: user.id,
        lessonId,
        sessionId: dto.sessionId,
        activeSeconds: dto.completionEvidence?.activeSeconds,
        videoPercentage: dto.completionEvidence?.videoPercentage,
      });

    if (!idempotencyKey) return run();

    return this.idempotency.execute(
      {
        userId: user.id,
        endpoint: `POST /learn/lessons/${lessonId}/complete`,
        key: idempotencyKey,
        request: dto,
      },
      run,
    );
  }
}

/** Dipakai klien yang ingin menghasilkan kunci sendiri saat mengirim ulang. */
export const newIdempotencyKey = randomUUID;
