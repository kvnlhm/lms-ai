import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiErrors } from '../../../../shared/http/api-envelope';
import { RequirePermissions } from '../../../identity/presentation/decorators';
import { DashboardAnalyticsService } from '../../application/dashboard-analytics.service';
import {
  DashboardAnalyticsDto,
  DashboardAnalyticsQueryDto,
} from '../dto/dashboard-analytics.dto';

@ApiTags('admin-analytics')
@RequirePermissions(PERMISSIONS.ANALYTICS_READ)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analytics: DashboardAnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Ringkasan aktivitas belajar dan performa kursus untuk Master' })
  @ApiEnvelope(DashboardAnalyticsDto)
  @ApiErrors(401, 403, 422)
  dashboard(@Query() query: DashboardAnalyticsQueryDto) {
    return this.analytics.dashboard(query.days);
  }
}
