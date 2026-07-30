import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LiveSessionService } from './application/live-session.service';
import { LiveSessionController } from './presentation/live-session.controller';

@Module({
  imports: [EnrollmentModule],
  controllers: [LiveSessionController],
  providers: [LiveSessionService],
})
export class LiveSessionModule {}
