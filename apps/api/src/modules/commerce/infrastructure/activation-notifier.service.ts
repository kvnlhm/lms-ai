import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeliveryStatus } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';
import { activationEmail } from '../../../shared/email/email-templates';
import { EmailService } from '../../../shared/email/email.service';

@Injectable()
export class ActivationNotifierService {
  private readonly config: AppConfig;

  constructor(
    config: ConfigService<{ app: AppConfig }, true>,
    private readonly email: EmailService,
  ) {
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
    return this.email.send(
      activationEmail({
        to: input.email,
        fullName: input.fullName,
        tierName: input.tierName,
        activationUrl: input.activationUrl,
      }),
    );
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
