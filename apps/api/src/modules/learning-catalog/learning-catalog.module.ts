import { Module } from '@nestjs/common';
import { CourseAuthoringService } from './application/course-authoring.service';
import { CourseCatalogService } from './application/course-catalog.service';
import { AdminCoursesController } from './presentation/controllers/admin-courses.controller';
import { CoursesController } from './presentation/controllers/courses.controller';

@Module({
  controllers: [CoursesController, AdminCoursesController],
  providers: [CourseCatalogService, CourseAuthoringService],
})
export class LearningCatalogModule {}
