import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors } from '../../../../shared/http/api-envelope';
import { AuditService } from '../../../../shared/audit/audit.service';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../../identity/presentation/decorators';
import { QuizAuthoringService } from '../../application/quiz-authoring.service';
import { SaveQuizDto } from '../dto/quiz.dto';
import { AdminQuizDto } from '../dto/quiz.response';

/**
 * Penyusunan kuis oleh Master.
 *
 * Terpisah dari controller pelajar justru karena inilah satu-satunya tempat
 * `isCorrect` ikut terkirim; memisahkannya membuat izin `courses.manage`
 * menjaga seluruh berkas ini sekaligus, bukan sebagian handler saja.
 */
@ApiTags('admin-catalog')
@RequirePermissions(PERMISSIONS.COURSES_MANAGE)
@Controller('admin/lessons')
export class AdminQuizController {
  constructor(
    private readonly quiz: QuizAuthoringService,
    private readonly audit: AuditService,
  ) {}

  @Get(':lessonId/quiz')
  @ApiOperation({ summary: 'Kuis pelajaran beserta kunci jawaban' })
  @ApiEnvelope(AdminQuizDto)
  @ApiErrors(401, 403, 404)
  async get(@Param('lessonId', new ParseUUIDPipe()) lessonId: string) {
    return this.quiz.get(lessonId);
  }

  @Put(':lessonId/quiz')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menyimpan pengaturan dan seluruh soal kuis' })
  @ApiEnvelope(AdminQuizDto)
  @ApiErrors(401, 403, 404, 409, 422)
  async save(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: SaveQuizDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const saved = await this.quiz.save(lessonId, dto);
    // Isi soal tidak ikut dicatat: audit log dibaca lebih luas daripada kuis
    // itu sendiri, dan kunci jawaban tidak perlu tersebar ke sana.
    await this.audit.record({
      actorUserId: user.id,
      action: 'quiz.saved',
      targetType: 'lesson',
      targetId: lessonId,
      after: {
        questionCount: saved.questions.length,
        passingScore: saved.passingScore,
        maxAttempts: saved.maxAttempts,
      },
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
    return saved;
  }

  @Delete(':lessonId/quiz')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus kuis yang belum pernah dikerjakan' })
  @ApiNoContentResponse({ description: 'Kuis dihapus.' })
  @ApiErrors(401, 403, 404, 409)
  async remove(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.quiz.remove(lessonId);
    await this.audit.record({
      actorUserId: user.id,
      action: 'quiz.deleted',
      targetType: 'lesson',
      targetId: lessonId,
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
  }
}
