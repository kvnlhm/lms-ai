import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LessonProgressService } from './application/lesson-progress.service';
import { LessonProgressController } from './presentation/controllers/lesson-progress.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [LessonProgressController],
  providers: [LessonProgressService],
})
export class LearningProgressModule {}
