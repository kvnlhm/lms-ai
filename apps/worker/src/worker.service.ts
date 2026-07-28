import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private readonly connection: IORedis;
  private worker?: Worker;

  constructor() {
    const redisUrl = required('REDIS_URL');
    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connection.connect();
    const pong = await this.connection.ping();
    if (pong !== 'PONG') throw new Error('Redis worker tidak siap.');

    this.worker = new Worker(
      'maintenance',
      async (job) => this.process(job),
      {
        connection: this.connection,
        prefix: process.env.REDIS_QUEUE_PREFIX ?? 'lms:queue',
        concurrency: positiveInt(process.env.QUEUE_CONCURRENCY_MAINTENANCE, 2),
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id ?? 'unknown'} gagal: ${error.message}`);
    });
    this.logger.log('Worker maintenance terhubung ke Redis dan siap menerima job.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection.quit();
  }

  private async process(job: Job): Promise<{ handledAt: string }> {
    // Foundation hanya membuktikan boundary queue. Handler domain ditambahkan
    // bersama outbox dispatcher pada fase Progress.
    this.logger.log(`Memproses ${job.name} (${job.id ?? 'tanpa-id'}).`);
    return { handledAt: new Date().toISOString() };
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} wajib diisi.`);
  return value;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
