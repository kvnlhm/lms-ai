import { Module } from '@nestjs/common';
import { DashboardAnalyticsService } from './application/dashboard-analytics.service';
import { LearnerInsightsService } from './application/learner-insights.service';
import { AdminAnalyticsController } from './presentation/controllers/admin-analytics.controller';

@Module({
  controllers: [AdminAnalyticsController],
  providers: [DashboardAnalyticsService, LearnerInsightsService],
})
export class AnalyticsModule {}
