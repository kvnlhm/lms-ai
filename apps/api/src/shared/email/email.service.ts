import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
}

/** `SENT` diterima Resend, `SKIPPED` provider sengaja dimatikan. Gagal berarti throw. */
export type EmailOutcome = 'SENT' | 'SKIPPED';

export interface EmailResult {
  status: EmailOutcome;
  /** Id Resend, dipakai mencocokkan webhook status pengantaran. */
  messageId: string | null;
}

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

  /**
   * Mengirim satu surat dan mengembalikan id Resend-nya.
   *
   * Statusnya `SENT`, bukan `DELIVERED`: balasan 2xx hanya berarti Resend
   * menerima suratnya untuk diantar. Apakah ia benar-benar sampai baru
   * diketahui dari webhook status, dan `id` inilah satu-satunya pegangan untuk
   * mencocokkan webhook itu dengan ordernya.
   */
  async send(email: OutgoingEmail): Promise<EmailResult> {
    if (this.config.provider === 'DISABLED') return { status: 'SKIPPED', messageId: null };
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

    if (!response.ok) {
      // Alasan dari Resend ikut dibawa. Kode status saja tidak membedakan
      // domain yang belum terverifikasi dari kunci API yang salah, padahal
      // keduanya menuntut tindakan yang sama sekali berbeda.
      throw new Error(
        `Resend menolak permintaan (${response.status}): ${await resendErrorMessage(response)}`,
      );
    }
    return { status: 'SENT', messageId: await resendMessageId(response) };
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

/**
 * Id surat dari balasan Resend.
 *
 * Balasan yang tidak terbaca tidak boleh menggagalkan pengiriman yang sudah
 * terlanjur diterima: akibatnya hanya kehilangan jejak status, bukan suratnya.
 */
async function resendMessageId(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { id?: string };
    return payload.id ?? null;
  } catch {
    return null;
  }
}

/** Kalimat galat dari Resend; `name` menyebut jenisnya, `message` rinciannya. */
async function resendErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { name?: string; message?: string };
    const pesan = payload.message;
    const jenis = payload.name;
    if (jenis && pesan) return `${jenis} — ${pesan}`;
    return pesan ?? jenis ?? 'tanpa keterangan';
  } catch {
    return 'balasan tidak dapat dibaca';
  }
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!,
  );
}
