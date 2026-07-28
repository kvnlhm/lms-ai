import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Terhubung ke PostgreSQL.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Tipe klien di dalam transaksi. Repository menerima ini supaya satu unit of
 * work dapat menulis business data dan outbox message dalam transaksi yang
 * sama (ADR-004).
 */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
