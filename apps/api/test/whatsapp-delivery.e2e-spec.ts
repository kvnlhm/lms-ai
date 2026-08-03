import { createHmac } from 'node:crypto';
import request from 'supertest';
import {
  WHATSAPP_APP_SECRET,
  WHATSAPP_VERIFY_TOKEN,
  prefix,
  startHarness,
  type Harness,
} from './support/harness';

/**
 * Tanda terima pengantaran WhatsApp.
 *
 * Sebelum ini `whatsapp_delivery_status` ditulis `SENT` semata karena Graph API
 * membalas 2xx — yang hanya berarti Meta menerima permintaannya. Pesan yang
 * diterima Meta masih bisa gagal diantar, dan satu-satunya pemberitahuannya
 * adalah webhook ini. Akibatnya pembeli yang tidak pernah menerima WhatsApp
 * tetap tercatat sudah dikirimi.
 */
describe('Tanda terima pengantaran WhatsApp', () => {
  let h: Harness;
  let tierId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    const course = await h.prisma.course.findFirstOrThrow({ select: { id: true } });
    const tier = await h.prisma.accessTier.create({
      data: {
        slug: `uji-wa-${Date.now()}`,
        name: 'Paket Uji WhatsApp',
        priceIdr: 10_000,
        durationMonths: 1,
        courses: { create: [{ courseId: course.id, position: 0 }] },
      },
      select: { id: true },
    });
    tierId = tier.id;
  });

  afterAll(async () => {
    await h.prisma.registrationOrder.deleteMany({ where: { id: { in: orderIds } } });
    await h.prisma.accessTierCourse.deleteMany({ where: { tierId } });
    await h.prisma.accessTier.deleteMany({ where: { id: tierId } });
    await h.close();
  });

  async function buatOrder(
    messageId: string,
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' = 'SENT',
  ): Promise<string> {
    const order = await h.prisma.registrationOrder.create({
      data: {
        orderCode: `REG-UJI-${messageId}`,
        tierId,
        fullName: 'Pembeli Uji',
        email: `uji-${messageId}@contoh.test`,
        phone: '6280000000000',
        grossAmount: 10_000,
        whatsAppDeliveryStatus: status,
        whatsAppMessageId: messageId,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
      select: { id: true },
    });
    orderIds.push(order.id);
    return order.id;
  }

  /** Meta menandatangani byte mentahnya, jadi badan yang dikirim harus persis. */
  function kirimWebhook(payload: unknown, secret: string = WHATSAPP_APP_SECRET) {
    const raw = JSON.stringify(payload);
    const signature = createHmac('sha256', secret).update(raw).digest('hex');
    return request(h.server)
      .post(`${prefix}/webhooks/whatsapp`)
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', `sha256=${signature}`)
      .send(raw);
  }

  function payloadStatus(
    messageId: string,
    status: string,
    errors?: Array<{ code: number; title: string; message: string }>,
  ) {
    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1234567890',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                statuses: [
                  { id: messageId, status, timestamp: '1785600000', recipient_id: '6280000000000', ...(errors ? { errors } : {}) },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  async function statusOrder(orderId: string) {
    return h.prisma.registrationOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { whatsAppDeliveryStatus: true, deliveryError: true },
    });
  }

  it('mengembalikan tantangan Meta apa adanya saat URL webhook dipasang', async () => {
    // Meta menuntut `hub.challenge` dikembalikan mentah. Bila ikut terbungkus
    // amplop `{ data, meta }`, pemasangan URL-nya ditolak tanpa penjelasan.
    const response = await request(h.server)
      .get(`${prefix}/webhooks/whatsapp`)
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': WHATSAPP_VERIFY_TOKEN,
        'hub.challenge': '9876543210',
      })
      .expect(200);
    expect(response.text).toBe('9876543210');
  });

  it('menolak jabat tangan dengan token verifikasi yang salah', async () => {
    await request(h.server)
      .get(`${prefix}/webhooks/whatsapp`)
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'token-keliru',
        'hub.challenge': '9876543210',
      })
      .expect(403);
  });

  it('menolak webhook tanpa tanda tangan maupun dengan tanda tangan palsu', async () => {
    const orderId = await buatOrder('wamid.tanpa-tanda-tangan');
    const payload = payloadStatus('wamid.tanpa-tanda-tangan', 'delivered');

    await request(h.server)
      .post(`${prefix}/webhooks/whatsapp`)
      .send(payload)
      .expect(403);

    await kirimWebhook(payload, 'rahasia-yang-salah').expect(403);

    // Yang ditolak tidak boleh meninggalkan jejak apa pun di basis data.
    expect((await statusOrder(orderId)).whatsAppDeliveryStatus).toBe('SENT');
  });

  it('menaikkan status menjadi DELIVERED ketika Meta memastikan pesannya sampai', async () => {
    const orderId = await buatOrder('wamid.sampai');
    await kirimWebhook(payloadStatus('wamid.sampai', 'delivered')).expect(200);
    expect(await statusOrder(orderId)).toMatchObject({
      whatsAppDeliveryStatus: 'DELIVERED',
      deliveryError: null,
    });
  });

  it('mencatat kegagalan pengantaran beserta kode galat Meta', async () => {
    // Inilah keadaan yang selama ini tidak terlihat: Meta menerima pesannya,
    // membalas 2xx, lalu tidak mengantarnya. Tanpa baris ini order tetap
    // tercatat `SENT` selamanya.
    const orderId = await buatOrder('wamid.gagal');
    await kirimWebhook(
      payloadStatus('wamid.gagal', 'failed', [
        {
          code: 131049,
          title: 'Message not delivered',
          message: 'This message was not delivered to maintain healthy ecosystem engagement.',
        },
      ]),
    ).expect(200);

    const tersimpan = await statusOrder(orderId);
    expect(tersimpan.whatsAppDeliveryStatus).toBe('FAILED');
    expect(tersimpan.deliveryError).toContain('131049');
    expect(tersimpan.deliveryError).toContain('healthy ecosystem');
  });

  it('tidak memundurkan status ketika Meta mengirim urutan yang terbalik', async () => {
    // Meta tidak menjamin urutan `sent`/`delivered`/`read`. Tanpa aturan maju
    // saja, `sent` yang menyusul menghapus bukti pengantaran yang sudah ada.
    const orderId = await buatOrder('wamid.terbalik');
    await kirimWebhook(payloadStatus('wamid.terbalik', 'read')).expect(200);
    expect((await statusOrder(orderId)).whatsAppDeliveryStatus).toBe('DELIVERED');

    await kirimWebhook(payloadStatus('wamid.terbalik', 'sent')).expect(200);
    expect((await statusOrder(orderId)).whatsAppDeliveryStatus).toBe('DELIVERED');

    // Pesan yang sudah terbukti sampai tidak dapat gagal belakangan.
    await kirimWebhook(
      payloadStatus('wamid.terbalik', 'failed', [
        { code: 131026, title: 'Undeliverable', message: 'Receiver incapable.' },
      ]),
    ).expect(200);
    expect(await statusOrder(orderId)).toMatchObject({
      whatsAppDeliveryStatus: 'DELIVERED',
      deliveryError: null,
    });
  });

  it('mengabaikan pesan di luar aplikasi ini tanpa memancing pengulangan Meta', async () => {
    // Webhook ini menerima status seluruh pesan nomor bisnisnya, termasuk yang
    // dikirim dari perkakas lain. Membalas galat hanya membuat Meta mengulang
    // kirim tanpa akhir.
    await kirimWebhook(payloadStatus('wamid.bukan-milik-kita', 'delivered')).expect(200);

    // Bentuk yang tidak dikenali pun tidak boleh menggagalkan permintaannya.
    await kirimWebhook({ object: 'whatsapp_business_account', entry: [] }).expect(200);
    await kirimWebhook({}).expect(200);
  });
});
