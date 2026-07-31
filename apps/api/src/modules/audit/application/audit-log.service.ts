import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export interface AuditLogFilter {
  actorUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
}

export interface AuditLogView {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actor: { id: string; fullName: string; email: string } | null;
  beforeData: unknown;
  afterData: unknown;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Sisi baca audit log, memenuhi PRD 13.
 *
 * Penulisannya sudah ada sejak awal di `shared/audit`, tetapi tidak pernah ada
 * cara membacanya. Satu-satunya jalan adalah query SQL langsung ke produksi —
 * persis hal yang paling tidak ingin dilakukan saat sedang menyelidiki
 * insiden.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filter: AuditLogFilter,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: AuditLogView[] }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
      ...(filter.targetType ? { targetType: filter.targetType } : {}),
      ...(filter.targetId ? { targetId: filter.targetId } : {}),
      // Awalan, bukan kecocokan penuh: `user.` menyaring seluruh tindakan atas
      // pengguna tanpa perlu menyebut satu per satu.
      ...(filter.action ? { action: { startsWith: filter.action } } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          beforeData: true,
          afterData: true,
          requestId: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    return { total, items: rows.map((row) => ({ ...row, id: row.id.toString() })) };
  }

  /**
   * Daftar jenis tindakan yang benar-benar pernah tercatat.
   *
   * Dipakai untuk mengisi penyaring di antarmuka. Daftar tetap yang ditulis
   * tangan akan langsung basi begitu ada tindakan baru yang dicatat.
   */
  async actions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      orderBy: { action: 'asc' },
      select: { action: true },
    });
    return rows.map(({ action }) => action);
  }
}
