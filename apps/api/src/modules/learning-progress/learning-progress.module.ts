import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LessonProgressService } from './application/lesson-progress.service';
import { LessonProgressController } from './presentation/controllers/lesson-progress.controller';
import { LearningHistoryService } from './application/learning-history.service';
import { MyLearningController } from './presentation/controllers/my-learning.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [LessonProgressController, MyLearningController],
  providers: [LessonProgressService, LearningHistoryService],
  // Modul kuis memakainya untuk menandai pelajaran selesai setelah lulus,
  // alih-alih menulis sendiri ke tabel progres milik modul ini.
  exports: [LessonProgressService],
})
export class LearningProgressModule {}
