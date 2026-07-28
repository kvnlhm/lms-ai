import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../errors/app-error';

const DEFAULT_TTL_HOURS = 24;

export interface IdempotencyScope {
  userId: string;
  endpoint: string;
  key: string;
  request: unknown;
}

/**
 * Menyimpan hasil mutation agar percobaan ulang dengan Idempotency-Key yang
 * sama mengembalikan respons yang sama.
 *
 * Ini lapisan kedua, bukan satu-satunya pengaman: operasi bisnis di bawahnya
 * juga dirancang idempotent, sehingga dua permintaan yang berlomba tetap
 * menghasilkan state akhir yang sama walau keduanya sempat berjalan.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(scope: IdempotencyScope, handler: () => Promise<T>): Promise<T> {
    const requestHash = hashRequest(scope.request);

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        userId_endpoint_key: {
          userId: scope.userId,
          endpoint: scope.endpoint,
          key: scope.key,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) throw AppError.idempotencyConflict();
      return existing.responseBody as T;
    }

    const result = await handler();

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key: scope.key,
          userId: scope.userId,
          endpoint: scope.endpoint,
          requestHash,
          responseBody: result as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + DEFAULT_TTL_HOURS * 3600 * 1000),
        },
      });
    } catch (error) {
      // Permintaan kembar menang balapan menuju unique constraint. State
      // bisnis sudah benar; kembalikan respons yang tersimpan lebih dulu.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const stored = await this.prisma.idempotencyKey.findUnique({
          where: {
            userId_endpoint_key: {
              userId: scope.userId,
              endpoint: scope.endpoint,
              key: scope.key,
            },
          },
        });
        if (stored) {
          if (stored.requestHash !== requestHash) throw AppError.idempotencyConflict();
          return stored.responseBody as T;
        }
      }
      this.logger.warn(`Gagal menyimpan hasil idempotensi: ${String(error)}`);
    }

    return result;
  }
}

function hashRequest(request: unknown): string {
  return createHash('sha256').update(stableStringify(request)).digest('hex');
}

/** Urutan kunci dinormalkan supaya isi yang sama selalu menghasilkan hash sama. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}
