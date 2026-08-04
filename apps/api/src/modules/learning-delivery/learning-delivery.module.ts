import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { BookmarkService } from './application/bookmark.service';
import { LearningDeliveryService } from './application/learning-delivery.service';
import { LessonMaterialService } from '../learning-catalog/application/lesson-material.service';
import { BookmarkController } from './presentation/controllers/bookmark.controller';
import { LearnController } from './presentation/controllers/learn.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [LearnController, BookmarkController],
  providers: [LearningDeliveryService, BookmarkService, LessonMaterialService],
  exports: [BookmarkService],
})
export class LearningDeliveryModule {}
