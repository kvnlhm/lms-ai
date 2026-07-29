import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { loadWorkerConfig, type WorkerConfig } from './config';
import { REDIS_CONNECTION } from './infrastructure/redis.provider';
import { AnalyticsProcessor } from './processors/analytics.processor';
import type { EventJob } from './processors/event-job';
import { NotificationsProcessor } from './processors/notifications.processor';

/**
 * Menyalakan worker BullMQ untuk setiap antrean yang punya handler.
 *
 * Antrean lain pada ADR-012 (critical, reports, media, ai) belum memiliki
 * konsumer; sengaja tidak dibuatkan worker kosong agar tidak terlihat seolah
 * job di antrean itu sudah tertangani.
 */
@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private readonly config: WorkerConfig = loadWorkerConfig();
  private readonly workers: Worker[] = [];

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
    private readonly analytics: AnalyticsProcessor,
    private readonly notifications: NotificationsProcessor,
  ) {}

  onModuleInit(): void {
    this.start('analytics', this.config.concurrency.analytics, (job) =>
      this.analytics.handle(job.data as EventJob),
    );

    this.start('notifications', this.config.concurrency.notifications, (job) =>
      Promise.resolve(this.notifications.handle(job.data as EventJob)),
    );

    this.logger.log('Worker analytics dan notifications siap.');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }

  private start(
    queue: string,
    concurrency: number,
    handler: (job: Job) => Promise<unknown>,
  ): void {
    const worker = new Worker(queue, handler, {
      connection: this.connection,
      prefix: this.config.queuePrefix,
      concurrency,
    });

    worker.on('failed', (job, error) => {
      this.logger.error(
        `Job ${job?.name ?? 'unknown'} (${job?.id ?? 'tanpa-id'}) di ${queue} gagal: ${error.message}`,
      );
    });

    this.workers.push(worker);
  }
}
