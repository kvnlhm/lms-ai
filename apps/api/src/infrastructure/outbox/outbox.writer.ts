import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { PrismaTransaction } from '../prisma/prisma.service';

export interface DomainEvent {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.InputJsonValue;
  schemaVersion?: number;
  occurredAt?: Date;
}

/**
 * Menulis event ke `outbox_messages` di dalam transaksi bisnis yang sama
 * (ADR-004). Tidak ada publikasi ke queue di sini: worker yang membaca tabel
 * ini setelah transaksi commit, sehingga notifikasi dan analytics tidak
 * pernah memblokir atau menggagalkan mutation utama.
 */
@Injectable()
export class OutboxWriter {
  async append(tx: PrismaTransaction, event: DomainEvent): Promise<string> {
    const eventId = randomUUID();
    await tx.outboxMessage.create({
      data: {
        eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        schemaVersion: event.schemaVersion ?? 1,
        occurredAt: event.occurredAt ?? new Date(),
      },
    });
    return eventId;
  }
}
