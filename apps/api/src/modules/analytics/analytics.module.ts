import { Module } from '@nestjs/common';
import { DashboardAnalyticsService } from './application/dashboard-analytics.service';
import { AdminAnalyticsController } from './presentation/controllers/admin-analytics.controller';

@Module({
  controllers: [AdminAnalyticsController],
  providers: [DashboardAnalyticsService],
})
export class AnalyticsModule {}
