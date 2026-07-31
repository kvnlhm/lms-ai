import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import { MidtransService } from './midtrans.service';

function createService(): MidtransService {
  const app = {
    webUrl: 'https://academy.example',
    commerce: {
      midtrans: {
        environment: 'PRODUCTION',
        serverKey: 'Mid-server-secret',
        clientKey: 'Mid-client-public',
      },
    },
  } as unknown as AppConfig;

  const config = { get: () => app } as unknown as ConfigService<{ app: AppConfig }, true>;
  return new MidtransService(config);
}

function respondWith(body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('MidtransService.getStatus', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns the canonical status when the transaction exists', async () => {
    respondWith({
      order_id: 'REG-abc',
      status_code: '200',
      gross_amount: '999000.00',
      transaction_status: 'settlement',
    });

    await expect(createService().getStatus('REG-abc')).resolves.toMatchObject({
      order_id: 'REG-abc',
      transaction_status: 'settlement',
    });
  });

  it('rejects a body-level 404 instead of passing an undefined order id onwards', async () => {
    // Bentuk balasan asli Midtrans: HTTP 200, tetapi transaksinya tidak ada dan
    // `order_id` tidak dikirim. Notifikasi uji dari dashboard memicu ini, dan
    // sebelumnya membuat webhook membalas 500 lalu diulang terus oleh Midtrans.
    respondWith({ status_code: '404', status_message: "Transaction doesn't exist." });

    await expect(createService().getStatus('REG-tidak-ada')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      status: 404,
    });
  });

  it('rejects when Midtrans itself answers with an HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;

    await expect(createService().getStatus('REG-abc')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
