import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import { loadWorkerConfig, type WorkerConfig } from '../config';
import { PrismaService } from '../infrastructure/prisma.service';
import { REDIS_CONNECTION } from '../infrastructure/redis.provider';
import { QUEUE_NAMES, type QueueName } from '../queue-names';
import { destinationsFor, jobIdFor, retryDelayMs } from './event-routing';

interface OutboxRow {
  id: string;
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  schema_version: number;
  occurred_at: Date;
  attempts: number;
}

/**
 * Memindahkan baris `outbox_messages` ke BullMQ (ADR-004).
 *
 * Alurnya: ambil batch yang belum terbit, kirim job, lalu tandai terbit.
 * Urutan ini sengaja "kirim dulu, tandai kemudian" sehingga kegagalan di
 * tengah menghasilkan pengiriman ganda, bukan event yang hilang. Konsumer
 * dibuat idempotent untuk menyerap kemungkinan itu — kehilangan event jauh
 * lebih mahal daripada memprosesnya dua kali.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly config: WorkerConfig = loadWorkerConfig();
  private readonly queues = new Map<QueueName, Queue>();
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    this.initQueues();
    this.startPolling();
    this.logger.log('Relay outbox aktif.');
  }

  /**
   * Menyiapkan koneksi antrean tanpa menyalakan poller.
   *
   * Dipisahkan supaya test dapat memanggil `publishBatch()` secara manual;
   * poller latar akan berlomba dengan test dan membuat hasilnya tidak pasti.
   */
  initQueues(): void {
    for (const name of QUEUE_NAMES) {
      this.queues.set(
        name,
        new Queue(name, { connection: this.connection, prefix: this.config.queuePrefix }),
      );
    }
  }

  startPolling(): void {
    this.schedule(0);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;

    let published = 0;
    try {
      published = await this.publishBatch();
    } catch (error) {
      this.logger.error(`Siklus relay gagal: ${describe(error)}`);
    } finally {
      this.running = false;
      // Batch penuh berarti kemungkinan masih ada antrean; lanjut segera.
      this.schedule(published > 0 ? 0 : this.config.outbox.idlePollMs);
    }
  }

  /** Mengembalikan jumlah event yang berhasil diterbitkan pada siklus ini. */
  async publishBatch(): Promise<number> {
    const rows = await this.claimBatch();
    if (rows.length === 0) return 0;

    let published = 0;
    for (const row of rows) {
      try {
        await this.dispatch(row);
        await this.prisma.outboxMessage.update({
          where: { id: row.id },
          data: { publishedAt: new Date(), lastError: null },
        });
        published += 1;
      } catch (error) {
        await this.recordFailure(row, error);
      }
    }
    return published;
  }

  /**
   * Mengambil batch dengan `FOR UPDATE SKIP LOCKED`.
   *
   * Tanpa itu, dua replika worker akan mengambil baris yang sama dan
   * menerbitkan event ganda. `SKIP LOCKED` membuat setiap replika melewati
   * baris yang sedang dipegang replika lain alih-alih menunggu.
   */
  private async claimBatch(): Promise<OutboxRow[]> {
    return this.prisma.$queryRaw<OutboxRow[]>`
      SELECT id, event_id, event_type, aggregate_type, aggregate_id,
             payload, schema_version, occurred_at, attempts
      FROM outbox_messages
      WHERE published_at IS NULL
        AND available_at <= now()
        AND attempts < ${this.config.outbox.maxAttempts}
      ORDER BY occurred_at ASC
      LIMIT ${this.config.outbox.batchSize}
      FOR UPDATE SKIP LOCKED
    `;
  }

  private async dispatch(row: OutboxRow): Promise<void> {
    const destinations = destinationsFor(row.event_type);

    if (destinations.length === 0) {
      // Event tanpa tujuan tetap ditandai terbit; membiarkannya menumpuk
      // akan membuat metrik keterlambatan outbox salah baca.
      this.logger.warn(`Event ${row.event_type} tidak memiliki tujuan antrean.`);
      return;
    }

    for (const destination of destinations) {
      const queue = this.queues.get(destination);
      if (!queue) throw new Error(`Antrean ${destination} tidak terdaftar.`);

      await queue.add(
        row.event_type,
        {
          eventId: row.event_id,
          eventType: row.event_type,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          schemaVersion: row.schema_version,
          occurredAt: row.occurred_at.toISOString(),
          payload: row.payload,
        },
        {
          // ID job diturunkan dari event dan tujuan, jadi pengiriman ganda
          // dari relay tidak menghasilkan dua job di Redis. Pemisahnya bukan
          // titik dua karena BullMQ menolaknya — karakter itu dipakai Redis
          // sebagai pemisah key.
          jobId: jobIdFor(row.event_id, destination),
          attempts: 5,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: false,
        },
      );
    }
  }

  private async recordFailure(row: OutboxRow, error: unknown): Promise<void> {
    const attempts = row.attempts + 1;
    const message = describe(error);

    await this.prisma.outboxMessage.update({
      where: { id: row.id },
      data: {
        attempts,
        lastError: message.slice(0, 1_000),
        availableAt: new Date(Date.now() + retryDelayMs(attempts)),
      },
    });

    if (attempts >= this.config.outbox.maxAttempts) {
      // Berhenti mencoba, tetapi barisnya tetap ada agar dapat diperiksa
      // dan direplay secara manual (ADR-012).
      this.logger.error(
        `Event ${row.event_id} (${row.event_type}) menyerah setelah ${attempts} percobaan: ${message}`,
      );
    } else {
      this.logger.warn(`Event ${row.event_id} gagal (percobaan ${attempts}): ${message}`);
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
