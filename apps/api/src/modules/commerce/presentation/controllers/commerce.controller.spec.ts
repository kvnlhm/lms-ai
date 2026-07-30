import {
  type ArgumentMetadata,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { MidtransNotificationDto } from '../dto/commerce.dto';

const metadata: ArgumentMetadata = { type: 'body', metatype: MidtransNotificationDto };

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

describe('midtrans webhook payload validation', () => {
  it('accepts the full provider payload and strips undeclared fields', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: 422,
    });

    const result = (await pipe.transform(
      { ...providerNotification },
      metadata,
    )) as MidtransNotificationDto;

    expect(result.order_id).toBe('REG-test');
    expect(result.transaction_status).toBe('capture');
    expect(result.fraud_status).toBe('accept');
    // Field milik provider tidak boleh bocor ke service.
    expect(result).not.toHaveProperty('merchant_id');
    expect(result).not.toHaveProperty('masked_card');
  });

  it('still rejects a payload missing a field the signature depends on', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: 422,
    });
    const { signature_key: _omitted, ...withoutSignature } = providerNotification;

    await expect(pipe.transform(withoutSignature, metadata)).rejects.toThrow();
  });

  it('documents why the global forbidNonWhitelisted pipe cannot be used here', async () => {
    // Regresi yang pernah terjadi di produksi: setiap notifikasi pembayaran
    // lunas ditolak 422 karena membawa field di luar DTO, sehingga akses
    // pelajar tidak pernah diberikan.
    const globalPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 422,
    });

    const rejection = await globalPipe
      .transform({ ...providerNotification }, metadata)
      .then(() => null)
      .catch((error: UnprocessableEntityException) => error);

    expect(rejection).toBeInstanceOf(UnprocessableEntityException);
    expect(JSON.stringify(rejection?.getResponse())).toMatch(/should not exist/);
  });
});
