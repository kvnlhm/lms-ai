import {
  type ArgumentMetadata,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { MidtransNotificationDto } from '../dto/commerce.dto';
import { MIDTRANS_NOTIFICATION_PIPE } from './commerce.controller';

/**
 * Salinan konfigurasi pipe global di `bootstrap.ts`. Pipe global tetap
 * dijalankan Nest untuk setiap parameter, termasuk yang punya pipe sendiri,
 * jadi tes harus melewatinya lebih dulu agar mencerminkan runtime.
 */
const globalPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  errorHttpStatusCode: 422,
});

/** Metatype parameter `@Body() rawNotification: Record<string, unknown>`. */
const rawBodyMetadata: ArgumentMetadata = { type: 'body', metatype: Object };

const dtoMetadata: ArgumentMetadata = { type: 'body', metatype: MidtransNotificationDto };

/**
 * Payload sebenarnya yang dikirim Midtrans sandbox untuk pembayaran kartu
 * kredit yang berhasil. Hanya delapan field pertama yang dideklarasikan DTO;
 * sisanya milik provider dan bisa bertambah kapan saja tanpa pemberitahuan.
 */
const providerNotification = {
  order_id: 'REG-test',
  status_code: '200',
  gross_amount: '999000.00',
  signature_key: 'a'.repeat(128),
  transaction_status: 'capture',
  transaction_id: '3ac230db-389b-435d-8b94-1244d4117848',
  payment_type: 'credit_card',
  fraud_status: 'accept',
  approval_code: '1596532317932',
  bank: 'bni',
  card_type: 'credit',
  channel: 'migs',
  channel_response_code: '00',
  channel_response_message: 'Approved',
  currency: 'IDR',
  expiry_time: '2026-07-31 00:30:23',
  masked_card: '481111-1114',
  merchant_id: 'G123456789',
  on_us: false,
  settlement_time: '2026-07-30 17:30:24',
  status_message: 'Success, Credit Card transaction is successful',
  transaction_time: '2026-07-30 17:30:23',
};

/** Meniru urutan nyata: pipe global lebih dulu, lalu validasi eksplisit. */
async function runWebhookPipeline(body: Record<string, unknown>) {
  const afterGlobal = (await globalPipe.transform(body, rawBodyMetadata)) as Record<
    string,
    unknown
  >;
  return (await MIDTRANS_NOTIFICATION_PIPE.transform(
    afterGlobal,
    dtoMetadata,
  )) as MidtransNotificationDto;
}

describe('midtrans webhook payload validation', () => {
  it('accepts the full provider payload and strips undeclared fields', async () => {
    const result = await runWebhookPipeline({ ...providerNotification });

    expect(result.order_id).toBe('REG-test');
    expect(result.transaction_status).toBe('capture');
    expect(result.fraud_status).toBe('accept');
    // Field milik provider tidak boleh bocor ke service.
    expect(result).not.toHaveProperty('merchant_id');
    expect(result).not.toHaveProperty('masked_card');
  });

  it('still rejects a payload missing a field the signature depends on', async () => {
    const withoutSignature = Object.fromEntries(
      Object.entries(providerNotification).filter(([key]) => key !== 'signature_key'),
    );

    await expect(runWebhookPipeline(withoutSignature)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('regression: binding the DTO directly would let the global pipe reject the payload', async () => {
    // Bug produksi 30 Juli 2026. Memasang pipe di level parameter TIDAK
    // menggantikan pipe global — Nest menjalankan keduanya, global lebih dulu.
    // Karena itu body harus diterima sebagai `Object` agar pipe global
    // melewatinya. Tes ini gagal jika seseorang mengembalikan binding langsung
    // ke `@Body() dto: MidtransNotificationDto`.
    const rejection = await globalPipe
      .transform({ ...providerNotification }, dtoMetadata)
      .then(() => null)
      .catch((error: UnprocessableEntityException) => error);

    expect(rejection).toBeInstanceOf(UnprocessableEntityException);
    expect(JSON.stringify(rejection?.getResponse())).toMatch(/should not exist/);
  });
});
