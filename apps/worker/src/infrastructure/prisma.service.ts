import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Akses database untuk worker.
 *
 * Worker hanya membaca `outbox_messages` dan menulis tabel turunan seperti
 * `learning_events`. Worker tidak menulis tabel bisnis inti: kebenaran progress
 * dan enrollment tetap milik Core API (ADR-012).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Terhubung ke PostgreSQL.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
