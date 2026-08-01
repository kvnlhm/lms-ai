import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LearningProgressModule } from '../learning-progress/learning-progress.module';
import { QuizAuthoringService } from './application/quiz-authoring.service';
import { QuizTakingService } from './application/quiz-taking.service';
import { AdminQuizController } from './presentation/controllers/admin-quiz.controller';
import { QuizController } from './presentation/controllers/quiz.controller';

@Module({
  imports: [EnrollmentModule, LearningProgressModule],
  controllers: [AdminQuizController, QuizController],
  providers: [QuizAuthoringService, QuizTakingService],
  exports: [QuizAuthoringService],
})
export class QuizModule {}
