import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeliveryStatus } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';

@Injectable()
export class ActivationNotifierService {
  private readonly config: AppConfig;

  constructor(config: ConfigService<{ app: AppConfig }, true>) {
    this.config = config.get('app', { infer: true });
  }

  async send(input: {
    fullName: string;
    email: string;
    phone: string;
    activationUrl: string;
    tierName: string;
  }): Promise<{
    email: DeliveryStatus;
    whatsApp: DeliveryStatus;
    errors: string[];
  }> {
    const [email, whatsApp] = await Promise.allSettled([
      this.sendEmail(input),
      this.sendWhatsApp(input),
    ]);
    return {
      email: email.status === 'fulfilled' ? email.value : 'FAILED',
      whatsApp: whatsApp.status === 'fulfilled' ? whatsApp.value : 'FAILED',
      errors: [email, whatsApp]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) =>
          result.reason instanceof Error ? result.reason.message : 'Provider notification gagal.',
        ),
    };
  }

  private async sendEmail(input: {
    fullName: string;
    email: string;
    activationUrl: string;
    tierName: string;
  }): Promise<DeliveryStatus> {
    const config = this.config.commerce.email;
    if (config.provider === 'DISABLED') return 'SKIPPED';
    if (!config.apiKey || !config.fromAddress) throw new Error('Konfigurasi Resend belum lengkap.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromAddress}>`,
        to: [input.email],
        subject: 'Aktifkan akun AIPreneur Academy',
        html: [
          `<p>Halo ${escapeHtml(input.fullName)},</p>`,
          `<p>Pembayaran paket <strong>${escapeHtml(input.tierName)}</strong> berhasil.</p>`,
          `<p><a href="${escapeHtml(input.activationUrl)}">Aktifkan akun dan buat password</a></p>`,
          '<p>Tautan ini bersifat pribadi dan memiliki masa berlaku.</p>',
        ].join(''),
      }),
    });
    if (!response.ok) throw new Error(`Resend menolak permintaan (${response.status}).`);
    return 'SENT';
  }

  private async sendWhatsApp(input: {
    phone: string;
    activationUrl: string;
  }): Promise<DeliveryStatus> {
    const config = this.config.commerce.whatsApp;
    if (config.provider === 'DISABLED') return 'SKIPPED';
    if (!config.phoneNumberId || !config.accessToken) {
      throw new Error('Konfigurasi WhatsApp Cloud API belum lengkap.');
    }
    const response = await fetch(
      `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: input.phone.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: config.activationTemplateName,
            language: { code: config.templateLanguage },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: input.activationUrl }],
              },
            ],
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`WhatsApp menolak permintaan (${response.status}).`);
    return 'SENT';
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!,
  );
}

