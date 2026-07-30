import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../../config/configuration';
import { AppError } from '../../../shared/errors/app-error';

interface SnapResponse {
  token: string;
  redirect_url: string;
}

export interface MidtransStatus {
  order_id: string;
  status_code: string;
  gross_amount: string;
  transaction_status: string;
  transaction_id?: string;
  payment_type?: string;
  fraud_status?: string;
}

@Injectable()
export class MidtransService {
  private readonly config: AppConfig['commerce']['midtrans'];
  private readonly webUrl: string;

  constructor(config: ConfigService<{ app: AppConfig }, true>) {
    const app = config.get('app', { infer: true });
    this.config = app.commerce.midtrans;
    this.webUrl = app.webUrl;
  }

  get clientConfiguration() {
    this.assertConfigured();
    return {
      clientKey: this.config.clientKey!,
      isProduction: this.config.environment === 'PRODUCTION',
    };
  }

  async createSnap(input: {
    orderCode: string;
    amount: number;
    itemName: string;
    fullName: string;
    email: string;
    phone: string;
  }): Promise<SnapResponse> {
    this.assertConfigured();
    const response = await fetch(`${this.snapBaseUrl()}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.serverKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderCode, gross_amount: input.amount },
        item_details: [
          { id: input.orderCode, price: input.amount, quantity: 1, name: input.itemName.slice(0, 50) },
        ],
        customer_details: {
          first_name: input.fullName,
          email: input.email,
          phone: input.phone,
        },
        callbacks: {
          finish: `${this.webUrl}/register/status?order=${encodeURIComponent(input.orderCode)}`,
        },
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as Partial<SnapResponse>;
    if (!response.ok || !payload.token || !payload.redirect_url) {
      throw AppError.validation({
        payment: ['Midtrans belum dapat membuat sesi pembayaran. Coba lagi beberapa saat.'],
      });
    }
    return { token: payload.token, redirect_url: payload.redirect_url };
  }

  verifySignature(input: {
    order_id: string;
    status_code: string;
    gross_amount: string;
    signature_key: string;
  }): boolean {
    if (!this.config.serverKey) return false;
    const expected = createHash('sha512')
      .update(`${input.order_id}${input.status_code}${input.gross_amount}${this.config.serverKey}`)
      .digest();
    const received = Buffer.from(input.signature_key, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  async getStatus(orderCode: string): Promise<MidtransStatus> {
    this.assertConfigured();
    const response = await fetch(
      `${this.apiBaseUrl()}/v2/${encodeURIComponent(orderCode)}/status`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.serverKey}:`).toString('base64')}`,
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) {
      throw AppError.validation({ payment: ['Status pembayaran tidak dapat diverifikasi.'] });
    }
    return (await response.json()) as MidtransStatus;
  }

  private assertConfigured(): void {
    if (!this.config.serverKey || !this.config.clientKey) {
      throw AppError.validation({
        payment: ['Pembayaran online belum diaktifkan oleh Master.'],
      });
    }
  }

  private snapBaseUrl(): string {
    return this.config.environment === 'PRODUCTION'
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com';
  }

  private apiBaseUrl(): string {
    return this.config.environment === 'PRODUCTION'
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com';
  }
}

