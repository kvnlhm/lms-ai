import { Module } from '@nestjs/common';
import { PrismaService } from './infrastructure/prisma.service';
import { redisProvider } from './infrastructure/redis.provider';
import { WorkerErrorMonitor } from './observability/error-monitor';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { AnalyticsProcessor } from './processors/analytics.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { WorkerService } from './worker.service';

@Module({
  providers: [
    PrismaService,
    redisProvider,
    AnalyticsProcessor,
    NotificationsProcessor,
    OutboxRelayService,
    WorkerErrorMonitor,
    WorkerService,
  ],
})
export class WorkerModule {}
