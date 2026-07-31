import { Injectable } from '@nestjs/common';
import type { ErrorSource, ErrorStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

export interface ErrorEventView {
  id: string;
  fingerprint: string;
  source: ErrorSource;
  status: ErrorStatus;
  type: string;
  message: string;
  stack: string | null;
  context: unknown;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

/** Membaca dan menutup galat yang sudah ditangani. Penulisannya ada di ErrorMonitorService. */
@Injectable()
export class ErrorLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filter: { status?: ErrorStatus; source?: ErrorSource },
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: ErrorEventView[] }> {
    const where: Prisma.ErrorEventWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.source ? { source: filter.source } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.errorEvent.count({ where }),
      this.prisma.errorEvent.findMany({
        where,
        // Yang paling baru terjadi lebih mendesak daripada yang paling sering:
        // galat lama yang sudah berhenti muncul tidak butuh perhatian hari ini.
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, items: rows.map(toView) };
  }

  async summary(): Promise<{ open: number; resolved: number; lastDay: number }> {
    const dayAgo = new Date(Date.now() - 24 * 3_600_000);
    const [open, resolved, lastDay] = await Promise.all([
      this.prisma.errorEvent.count({ where: { status: 'OPEN' } }),
      this.prisma.errorEvent.count({ where: { status: 'RESOLVED' } }),
      this.prisma.errorEvent.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    ]);
    return { open, resolved, lastDay };
  }

  async resolve(id: string, actorUserId: string): Promise<ErrorEventView> {
    const row = await this.prisma.errorEvent
      .update({
        where: { id: toBigInt(id) },
        data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: actorUserId },
      })
      .catch(() => {
        throw AppError.notFound();
      });
    return toView(row);
  }

  async reopen(id: string): Promise<ErrorEventView> {
    const row = await this.prisma.errorEvent
      .update({
        where: { id: toBigInt(id) },
        data: { status: 'OPEN', resolvedAt: null, resolvedBy: null },
      })
      .catch(() => {
        throw AppError.notFound();
      });
    return toView(row);
  }
}

function toBigInt(id: string): bigint {
  try {
    return BigInt(id);
  } catch {
    throw AppError.notFound();
  }
}

/**
 * `id` dikirim sebagai string.
 *
 * Kuncinya `BigInt`, dan JSON tidak mengenal tipe itu — dibiarkan apa adanya,
 * serialisasi responsnya melempar `TypeError` dan endpointnya balas 500.
 */
function toView(row: {
  id: bigint;
  fingerprint: string;
  source: ErrorSource;
  status: ErrorStatus;
  type: string;
  message: string;
  stack: string | null;
  context: unknown;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}): ErrorEventView {
  return { ...row, id: row.id.toString() };
}
