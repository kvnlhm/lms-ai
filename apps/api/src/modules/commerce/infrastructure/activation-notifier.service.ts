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
    whatsAppMessageId: string | null;
    errors: string[];
  }> {
    const [email, whatsApp] = await Promise.allSettled([
      this.sendEmail(input),
      this.sendWhatsApp(input),
    ]);
    return {
      email: email.status === 'fulfilled' ? email.value : 'FAILED',
      whatsApp: whatsApp.status === 'fulfilled' ? whatsApp.value.status : 'FAILED',
      whatsAppMessageId: whatsApp.status === 'fulfilled' ? whatsApp.value.messageId : null,
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

  /**
   * Mengirim template aktivasi dan mengembalikan `wamid` dari balasan Meta.
   *
   * Statusnya sengaja tetap `SENT`, bukan `DELIVERED`: balasan 2xx hanya
   * berarti Meta menerima permintaannya untuk diproses. Pengantaran yang
   * sesungguhnya baru diketahui dari webhook status, dan `wamid` inilah
   * satu-satunya pegangan untuk mencocokkan webhook itu dengan ordernya.
   */
  private async sendWhatsApp(input: {
    phone: string;
    activationUrl: string;
  }): Promise<{ status: DeliveryStatus; messageId: string | null }> {
    const config = this.config.commerce.whatsApp;
    if (config.provider === 'DISABLED') return { status: 'SKIPPED', messageId: null };
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
    if (!response.ok) {
      // Alasan dari Meta ikut dibawa. Sebelumnya hanya kode status yang
      // dilaporkan, sehingga "WhatsApp menolak permintaan (404)" bisa berarti
      // nomor salah, token tidak berizin, atau nama template tidak ada —
      // dan membedakannya menuntut memanggil ulang Graph API secara manual.
      // Badan galat Meta tidak memuat token maupun data pribadi penerima.
      throw new Error(
        `WhatsApp menolak permintaan (${response.status}): ${await metaErrorMessage(response)}`,
      );
    }
    return { status: 'SENT', messageId: await metaMessageId(response) };
  }
}

/**
 * `wamid` pesan pertama pada balasan Graph API.
 *
 * Balasan yang tidak dapat dibaca tidak boleh menggagalkan pengiriman yang
 * sudah terlanjur diterima Meta — akibatnya hanya kehilangan jejak status,
 * bukan kehilangan pesannya.
 */
async function metaMessageId(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
    return payload.messages?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Mengambil kalimat galat dari balasan Graph API.
 *
 * Meta menaruh keterangan paling berguna pada `error.error_data.details` —
 * misalnya "template name (x) does not exist in id" — sedangkan `error.message`
 * hanya memuat kode dan judul umum. Keduanya digabung bila ada.
 */
async function metaErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; error_data?: { details?: string } };
    };
    const pesan = payload.error?.message;
    const rinci = payload.error?.error_data?.details;
    if (pesan && rinci) return `${pesan} — ${rinci}`;
    return rinci ?? pesan ?? 'tanpa keterangan';
  } catch {
    // Balasan non-JSON, misalnya halaman galat dari proxy di depan Graph API.
    return 'balasan tidak dapat dibaca';
  }
}
