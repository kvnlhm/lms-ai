import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../../../../shared/http/api-envelope';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser } from '../../../identity/presentation/decorators';
import { QuizTakingService } from '../../application/quiz-taking.service';
import { SubmitQuizDto } from '../dto/quiz.dto';
import { LearnerQuizDto, QuizAttemptResultDto } from '../dto/quiz.response';

@ApiTags('learning-delivery')
@Controller('learn/lessons')
export class QuizController {
  constructor(private readonly quiz: QuizTakingService) {}

  @Get(':lessonId/quiz')
  @ApiOperation({ summary: 'Soal kuis tanpa kunci jawaban beserta sisa percobaan' })
  @ApiEnvelope(LearnerQuizDto)
  @ApiErrors(401, 403, 404)
  async get(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quiz.forLearner(user.id, lessonId);
  }

  @Post(':lessonId/quiz/attempts')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mengirim jawaban kuis dan menerima nilainya' })
  @ApiEnvelope(QuizAttemptResultDto)
  @ApiErrors(401, 403, 404, 409, 422)
  async submit(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quiz.submit({ userId: user.id, lessonId, answers: dto.answers });
  }
}
