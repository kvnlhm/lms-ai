import { Module } from '@nestjs/common';
import { CourseCatalogService } from './application/course-catalog.service';
import { CoursesController } from './presentation/controllers/courses.controller';

@Module({
  controllers: [CoursesController],
  providers: [CourseCatalogService],
})
export class LearningCatalogModule {}
