import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../../../../shared/http/api-envelope';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser } from '../../../identity/presentation/decorators';
import { LearningHistoryService } from '../../application/learning-history.service';
import {
  ContinueLearningDto,
  LearningHistoryPageDto,
  LearningHistoryQueryDto,
} from '../dto/learning-history.dto';

@ApiTags('learning-progress')
@Controller('me')
export class MyLearningController {
  constructor(private readonly learning: LearningHistoryService) {}

  @Get('continue-learning')
  @ApiOperation({ summary: 'Aktivitas belajar aktif dengan prioritas tertinggi' })
  @ApiEnvelope(ContinueLearningDto)
  @ApiErrors(401)
  continueLearning(@CurrentUser() user: AuthenticatedUser) {
    return this.learning.continueLearning(user.id);
  }

  @Get('learning-history')
  @ApiOperation({ summary: 'Histori aktivitas belajar milik pengguna saat ini' })
  @ApiEnvelope(LearningHistoryPageDto)
  @ApiErrors(401, 422)
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LearningHistoryQueryDto,
  ) {
    return this.learning.history(user.id, query.cursor, query.limit);
  }
}
