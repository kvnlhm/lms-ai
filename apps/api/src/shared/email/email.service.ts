import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
}

/** `SENT` terkirim, `SKIPPED` provider sengaja dimatikan. Gagal berarti throw. */
export type EmailOutcome = 'SENT' | 'SKIPPED';

/**
 * Satu-satunya jalan keluar email dari API.
 *
 * Sebelumnya pengiriman email hanya ada di dalam modul commerce, sehingga
 * aktivasi akun menjadi satu-satunya surat yang pernah dikirim sistem ini.
 * Diangkat ke shared supaya identity juga dapat memakainya tanpa modul
 * identity bergantung pada commerce.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly config: AppConfig['email'];

  constructor(config: ConfigService<{ app: AppConfig }, true>) {
    this.config = config.get('app', { infer: true }).email;
  }

  get enabled(): boolean {
    return this.config.provider !== 'DISABLED';
  }

  async send(email: OutgoingEmail): Promise<EmailOutcome> {
    if (this.config.provider === 'DISABLED') return 'SKIPPED';
    if (!this.config.apiKey || !this.config.fromAddress) {
      throw new Error('Konfigurasi Resend belum lengkap.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${this.config.fromName} <${this.config.fromAddress}>`,
        to: [email.to],
        subject: email.subject,
        html: email.html,
      }),
    });

    if (!response.ok) throw new Error(`Resend menolak permintaan (${response.status}).`);
    return 'SENT';
  }

  /**
   * Mengirim tanpa membuat pemanggilnya ikut gagal.
   *
   * Dipakai pada alur yang jawabannya tidak boleh membocorkan apakah emailnya
   * benar-benar terkirim — lihat AuthService.requestPasswordReset.
   */
  sendInBackground(email: OutgoingEmail, context: string): void {
    void this.send(email).catch((error: unknown) => {
      this.logger.error(
        `Email ${context} gagal dikirim: ${
          error instanceof Error ? error.message : 'penyebab tidak diketahui'
        }`,
      );
    });
  }
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!,
  );
}
