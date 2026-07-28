import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LearningDeliveryService } from './application/learning-delivery.service';
import { LearnController } from './presentation/controllers/learn.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [LearnController],
  providers: [LearningDeliveryService],
})
export class LearningDeliveryModule {}
