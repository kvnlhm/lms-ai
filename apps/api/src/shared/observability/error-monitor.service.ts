import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ErrorSource, Prisma } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { errorAlertEmail } from '../email/email-templates';
import { EmailService } from '../email/email.service';
import {
  MAX_MESSAGE_LENGTH,
  MAX_STACK_LENGTH,
  fingerprintOf,
  truncate,
} from './error-fingerprint';

export interface CaptureInput {
  source: ErrorSource;
  type: string;
  message: string;
  stack?: string;
  /** Rute yang gagal, mis. `POST /api/v1/orders`. */
  route?: string;
  /** Konteks tambahan; jangan diisi email, nama, atau isi payload pengguna. */
  context?: Record<string, unknown>;
}

/**
 * Pencatat galat runtime, sesuai PRD 12.7.
 *
 * Sebelumnya galat hanya berakhir di log container. Log itu hilang setiap
 * deploy dan tidak ada yang membacanya kecuali sedang mencari sesuatu, sehingga
 * kegagalan baru diketahui ketika ada yang mengeluh — atau tidak diketahui
 * sama sekali.
 *
 * Dua aturan yang menentukan apakah ini berguna atau justru diabaikan:
 * kejadian dikelompokkan per fingerprint sehingga satu bug tetap satu baris,
 * dan surat hanya dikirim saat sebuah galat pertama kali muncul atau muncul
 * lagi setelah ditutup.
 */
@Injectable()
export class ErrorMonitorService {
  private readonly logger = new Logger(ErrorMonitorService.name);
  private readonly app: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  /**
   * Mencatat tanpa membuat pemanggilnya menunggu atau ikut gagal.
   *
   * Dipanggil dari exception filter, yang harus tetap membalas cepat: pengguna
   * sudah mengalami satu kegagalan, tidak perlu ditambah menunggu pencatatan.
   */
  capture(input: CaptureInput): void {
    void this.record(input).catch((error: unknown) => {
      this.logger.error(
        `Gagal mencatat galat: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async record(input: CaptureInput): Promise<void> {
    const message = truncate(input.message || 'Tanpa pesan', MAX_MESSAGE_LENGTH);
    const stack = input.stack ? truncate(input.stack, MAX_STACK_LENGTH) : undefined;
    const fingerprint = fingerprintOf({
      source: input.source,
      type: input.type,
      message,
      stack,
      route: input.route,
    });

    // Dibaca lebih dulu untuk membedakan galat baru dari galat yang muncul
    // kembali setelah ditutup. Dua proses yang menemui galat sama persis pada
    // saat bersamaan bisa sama-sama menganggapnya baru; akibat terburuknya
    // hanya satu surat kembar, dan itu sudah dibatasi anggaran surat per jam.
    const previous = await this.prisma.errorEvent.findUnique({
      where: { fingerprint },
      select: { status: true },
    });
    const isRegression = previous?.status === 'RESOLVED';

    await this.prisma.errorEvent.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: input.source,
        type: input.type,
        message,
        stack: stack ?? null,
        context: toJson(input.context) ?? Prisma.DbNull,
      },
      update: {
        occurrences: { increment: 1 },
        lastSeenAt: new Date(),
        // Kejadian terakhir yang disimpan, karena itu yang paling mungkin masih
        // dapat direproduksi saat seseorang akhirnya membukanya.
        message,
        stack: stack ?? null,
        context: toJson(input.context) ?? Prisma.DbNull,
        ...(isRegression ? { status: 'OPEN' as const, resolvedAt: null, resolvedBy: null } : {}),
      },
    });

    if (previous && !isRegression) return;
    await this.alert({ ...input, message, stack, fingerprint, isRegression });
  }

  private async alert(input: {
    source: ErrorSource;
    type: string;
    message: string;
    stack?: string;
    route?: string;
    fingerprint: string;
    isRegression: boolean;
  }): Promise<void> {
    const recipient = this.app.observability.alertTo;
    if (!recipient || !this.email.enabled) return;
    if (!(await this.withinBudget())) {
      this.logger.warn(
        `Peringatan galat ${input.fingerprint} tidak dikirim: anggaran surat per jam habis.`,
      );
      return;
    }

    try {
      await this.email.send(
        errorAlertEmail({
          to: recipient,
          appName: this.app.appName,
          source: input.source,
          type: input.type,
          message: input.message,
          route: input.route,
          stack: input.stack,
          isRegression: input.isRegression,
          dashboardUrl: `${this.app.webUrl}/master/errors`,
        }),
      );
      await this.prisma.errorEvent.update({
        where: { fingerprint: input.fingerprint },
        data: { alertedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Peringatan galat gagal dikirim: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Satu insiden dapat memunculkan puluhan galat berbeda sekaligus — deploy
   * yang rusak, database yang tidak terjangkau. Tanpa batas ini, kotak masuk
   * penerimanya penuh dan justru berhenti dibaca.
   */
  private async withinBudget(): Promise<boolean> {
    const hour = Math.floor(Date.now() / 3_600_000);
    const key = `${this.app.redis.cachePrefix}error-alert:budget:${hour}`;
    const used = await this.redis.client.incr(key);
    if (used === 1) await this.redis.client.expire(key, 3_600);
    return used <= this.app.observability.alertMaxPerHour;
  }
}

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
