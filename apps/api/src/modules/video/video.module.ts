import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { VideoService } from './application/video.service';
import { VideoController } from './presentation/video.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}
