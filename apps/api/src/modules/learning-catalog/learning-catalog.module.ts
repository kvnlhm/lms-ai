import { Module } from '@nestjs/common';
import { VideoModule } from '../video/video.module';
import { CourseAuthoringService } from './application/course-authoring.service';
import { CourseCatalogService } from './application/course-catalog.service';
import { CourseThumbnailService } from './application/course-thumbnail.service';
import { AdminCoursesController } from './presentation/controllers/admin-courses.controller';
import { CoursesController } from './presentation/controllers/courses.controller';

@Module({
  imports: [VideoModule],
  controllers: [CoursesController, AdminCoursesController],
  providers: [CourseCatalogService, CourseAuthoringService, CourseThumbnailService],
})
export class LearningCatalogModule {}
