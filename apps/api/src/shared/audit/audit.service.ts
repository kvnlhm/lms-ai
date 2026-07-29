import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface AuditEntry {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string;
  /** Cuplikan keadaan; disimpan apa adanya sebagai JSON. */
  before?: unknown;
  after?: unknown;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Catatan tindakan administratif.
 *
 * Kegagalan menulis audit tidak boleh membatalkan tindakan yang sudah
 * tersimpan — itu akan membuat pengguna kehilangan pekerjaannya karena
 * masalah pencatatan. Kegagalannya dicatat ke log agar tetap terlihat.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          beforeData: toJson(entry.before),
          afterData: toJson(entry.after),
          requestId: entry.requestId ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent?.slice(0, 400) ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Gagal menulis audit untuk ${entry.action} pada ${entry.targetType}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}

/**
 * Menyiapkan nilai untuk kolom JSON Prisma.
 *
 * `undefined` berarti "jangan tulis kolom ini", sedangkan nilai lain
 * diserialkan lewat JSON supaya tipe seperti Date menjadi string.
 */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
