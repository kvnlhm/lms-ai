import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../infrastructure/prisma.service';

const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 4_000;

/**
 * Salinan logika pengelompokan dari `apps/api/src/shared/observability`.
 *
 * Sengaja tidak diangkat ke `@lms/contracts`: paket itu ikut masuk bundle
 * browser, sedangkan fungsi ini memerlukan `node:crypto`. Bila logikanya
 * berubah, kedua salinan harus ikut berubah — jika tidak, galat yang sama dari
 * API dan worker akan tercatat sebagai dua masalah berbeda.
 */
function normaliseMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
    .replace(/\b0x[0-9a-f]+\b/gi, '{hex}')
    .replace(/"[^"]*"/g, '"{str}"')
    .replace(/'[^']*'/g, "'{str}'")
    .replace(/\b\d+\b/g, '{n}')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function topFrame(stack: string | undefined): string {
  if (!stack) return '';
  for (const line of stack.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;
    if (trimmed.includes('node_modules') || trimmed.includes('node:internal')) continue;
    return trimmed.replace(/:\d+:\d+\)?$/, ')');
  }
  return '';
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

export interface WorkerCaptureInput {
  /** Nama antrean, mis. `notifications`. Ikut membedakan kelompok galat. */
  queue: string;
  jobName?: string;
  error: unknown;
}

/**
 * Mencatat kegagalan job ke tabel yang sama dengan galat API, sesuai PRD 12.7.
 *
 * Sebelumnya kegagalan job hanya muncul di log container worker — tempat yang
 * bahkan lebih jarang dibuka daripada log API, karena tidak ada pengguna yang
 * mengeluh saat sebuah job gagal diam-diam.
 */
@Injectable()
export class WorkerErrorMonitor {
  private readonly logger = new Logger(WorkerErrorMonitor.name);
  private readonly alertTo = process.env.ERROR_ALERT_TO;
  private readonly resendKey = process.env.RESEND_API_KEY;
  private readonly fromAddress = process.env.EMAIL_FROM_ADDRESS;
  private readonly fromName = process.env.EMAIL_FROM_NAME ?? 'Academy AIPreneur';

  constructor(private readonly prisma: PrismaService) {}

  capture(input: WorkerCaptureInput): void {
    void this.record(input).catch((error: unknown) => {
      this.logger.error(
        `Gagal mencatat kegagalan job: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async record(input: WorkerCaptureInput): Promise<void> {
    const error = input.error;
    const type = error instanceof Error ? error.constructor.name : 'UnknownError';
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = truncate(rawMessage || 'Tanpa pesan', MAX_MESSAGE_LENGTH);
    const stack =
      error instanceof Error && error.stack ? truncate(error.stack, MAX_STACK_LENGTH) : undefined;

    const fingerprint = createHash('sha256')
      .update(['WORKER', type, normaliseMessage(message), topFrame(stack), input.queue].join('|'))
      .digest('hex')
      .slice(0, 40);

    const previous = await this.prisma.errorEvent.findUnique({
      where: { fingerprint },
      select: { status: true },
    });
    const isRegression = previous?.status === 'RESOLVED';

    await this.prisma.errorEvent.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: 'WORKER',
        type,
        message,
        stack: stack ?? null,
        context: { queue: input.queue, jobName: input.jobName ?? null },
      },
      update: {
        occurrences: { increment: 1 },
        lastSeenAt: new Date(),
        message,
        stack: stack ?? null,
        context: { queue: input.queue, jobName: input.jobName ?? null },
        ...(isRegression ? { status: 'OPEN' as const, resolvedAt: null, resolvedBy: null } : {}),
      },
    });

    if (previous && !isRegression) return;
    await this.alert({ type, message, queue: input.queue, isRegression, fingerprint });
  }

  /**
   * Worker tidak memakai EmailService milik API — modulnya tidak dapat
   * diimpor lintas aplikasi. Panggilan langsung ini cukup karena isinya hanya
   * satu surat sederhana, dan diam saja bila konfigurasinya belum lengkap.
   */
  private async alert(input: {
    type: string;
    message: string;
    queue: string;
    isRegression: boolean;
    fingerprint: string;
  }): Promise<void> {
    if (!this.alertTo || !this.resendKey || !this.fromAddress) return;

    const headline = input.isRegression ? 'Kegagalan job muncul lagi' : 'Kegagalan job baru';
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromAddress}>`,
          to: [this.alertTo],
          subject: `[Worker] ${headline}: ${input.type}`,
          html:
            `<p><strong>${escapeHtml(headline)}</strong> pada antrean ` +
            `<code>${escapeHtml(input.queue)}</code>.</p>` +
            `<p><strong>${escapeHtml(input.type)}</strong>: ${escapeHtml(input.message)}</p>`,
        }),
      });
      if (!response.ok) throw new Error(`Resend menolak permintaan (${response.status}).`);
      await this.prisma.errorEvent.update({
        where: { fingerprint: input.fingerprint },
        data: { alertedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Peringatan kegagalan job gagal dikirim: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!,
  );
}
