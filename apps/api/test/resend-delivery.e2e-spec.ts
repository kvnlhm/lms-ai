import { createHmac } from 'node:crypto';
import request from 'supertest';
import { RESEND_SIGNING_SECRET, prefix, startHarness, type Harness } from './support/harness';

/**
 * Tanda terima pengantaran email, sepasang dengan yang sudah ada untuk WhatsApp.
 *
 * `email_delivery_status` ditulis `SENT` hanya karena Resend membalas 2xx —
 * yang berarti Resend menerima suratnya, bukan surat itu sampai. Pada uji
 * rantai pendaftaran 3 Agustus 2026 sebuah order berstatus `SENT` sementara
 * suratnya mendarat di Spam; tidak ada apa pun di basis data yang membedakan
 * itu dari surat yang masuk Kotak Masuk.
 */
describe('Tanda terima pengantaran email', () => {
  let h: Harness;
  let tierId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    const course = await h.prisma.course.findFirstOrThrow({ select: { id: true } });
    const tier = await h.prisma.accessTier.create({
      data: {
        slug: `uji-resend-${Date.now()}`,
        name: 'Paket Uji Resend',
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
        orderCode: `REG-UJI-RESEND-${messageId}`,
        tierId,
        fullName: 'Pembeli Uji',
        email: `uji-${messageId}@contoh.test`,
        phone: '6280000000000',
        grossAmount: 10_000,
        emailDeliveryStatus: status,
        emailMessageId: messageId,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
      select: { id: true },
    });
    orderIds.push(order.id);
    return order.id;
  }

  /**
   * Menandatangani seperti Svix: yang di-HMAC adalah `id.stempel.badan`, dan
   * kuncinya hasil dekode base64 dari rahasia setelah awalan `whsec_`.
   */
  function kirimWebhook(
    payload: unknown,
    pilihan: { secret?: string; timestamp?: number; id?: string } = {},
  ) {
    const raw = JSON.stringify(payload);
    const id = pilihan.id ?? 'msg_2abcdef';
    const timestamp = String(pilihan.timestamp ?? Math.floor(Date.now() / 1000));
    const kunci = Buffer.from(
      (pilihan.secret ?? RESEND_SIGNING_SECRET).replace(/^whsec_/, ''),
      'base64',
    );
    const signature = createHmac('sha256', kunci)
      .update(`${id}.${timestamp}.${raw}`)
      .digest('base64');
    return request(h.server)
      .post(`${prefix}/webhooks/resend`)
      .set('Content-Type', 'application/json')
      .set('svix-id', id)
      .set('svix-timestamp', timestamp)
      .set('svix-signature', `v1,${signature}`)
      .send(raw);
  }

  function peristiwa(messageId: string, type: string, bounce?: Record<string, string>) {
    return {
      type,
      created_at: '2026-08-03T09:00:00.000Z',
      data: { email_id: messageId, to: ['pembeli@contoh.test'], ...(bounce ? { bounce } : {}) },
    };
  }

  async function statusOrder(orderId: string) {
    return h.prisma.registrationOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { emailDeliveryStatus: true, deliveryError: true },
    });
  }

  it('menolak webhook tanpa tanda tangan maupun dengan rahasia yang salah', async () => {
    const orderId = await buatOrder('resend-tanpa-tanda-tangan');
    const payload = peristiwa('resend-tanpa-tanda-tangan', 'email.delivered');

    await request(h.server).post(`${prefix}/webhooks/resend`).send(payload).expect(403);
    await kirimWebhook(payload, { secret: 'whsec_cmFoYXNpYS15YW5nLXNhbGFo' }).expect(403);

    expect((await statusOrder(orderId)).emailDeliveryStatus).toBe('SENT');
  });

  it('menolak tanda tangan sah yang stempel waktunya kedaluwarsa', async () => {
    // Tanda tangan Svix mencakup stempel waktu justru supaya permintaan lama
    // yang direkam penyerang tidak dapat diputar ulang.
    const orderId = await buatOrder('resend-kedaluwarsa');
    await kirimWebhook(peristiwa('resend-kedaluwarsa', 'email.delivered'), {
      timestamp: Math.floor(Date.now() / 1000) - 3_600,
    }).expect(403);
    expect((await statusOrder(orderId)).emailDeliveryStatus).toBe('SENT');
  });

  it('menaikkan status menjadi DELIVERED ketika Resend memastikan suratnya sampai', async () => {
    const orderId = await buatOrder('resend-sampai');
    await kirimWebhook(peristiwa('resend-sampai', 'email.delivered')).expect(200);
    expect(await statusOrder(orderId)).toMatchObject({
      emailDeliveryStatus: 'DELIVERED',
      deliveryError: null,
    });
  });

  it('mencatat pantulan beserta jenis dan alasannya', async () => {
    const orderId = await buatOrder('resend-pantul');
    await kirimWebhook(
      peristiwa('resend-pantul', 'email.bounced', {
        type: 'Permanent',
        subType: 'General',
        message: 'The recipient address does not exist.',
      }),
    ).expect(200);

    const tersimpan = await statusOrder(orderId);
    expect(tersimpan.emailDeliveryStatus).toBe('FAILED');
    // Jenis pantulan menentukan tindakan: `Permanent` berarti alamatnya memang
    // tidak ada, sedangkan `Transient` cukup dikirim ulang.
    expect(tersimpan.deliveryError).toContain('Permanent');
    expect(tersimpan.deliveryError).toContain('does not exist');
  });

  it('tidak memundurkan status ketika peristiwa tiba tidak berurutan', async () => {
    const orderId = await buatOrder('resend-terbalik');
    await kirimWebhook(peristiwa('resend-terbalik', 'email.delivered')).expect(200);
    expect((await statusOrder(orderId)).emailDeliveryStatus).toBe('DELIVERED');

    await kirimWebhook(peristiwa('resend-terbalik', 'email.sent')).expect(200);
    expect((await statusOrder(orderId)).emailDeliveryStatus).toBe('DELIVERED');

    await kirimWebhook(
      peristiwa('resend-terbalik', 'email.bounced', { type: 'Transient', message: 'Mailbox full.' }),
    ).expect(200);
    expect(await statusOrder(orderId)).toMatchObject({
      emailDeliveryStatus: 'DELIVERED',
      deliveryError: null,
    });
  });

  it('membiarkan status apa adanya untuk peristiwa yang bukan soal pengantaran', async () => {
    // `email.complained` berarti penerima menandainya spam — yang justru
    // membuktikan suratnya sampai, jadi menurunkannya ke FAILED akan berbohong
    // ke arah sebaliknya. `email.delivery_delayed` belum berarti gagal.
    const orderId = await buatOrder('resend-abaikan', 'DELIVERED');
    for (const type of ['email.complained', 'email.delivery_delayed', 'email.opened']) {
      await kirimWebhook(peristiwa('resend-abaikan', type)).expect(200);
    }
    expect((await statusOrder(orderId)).emailDeliveryStatus).toBe('DELIVERED');
  });

  it('mengabaikan surat di luar aplikasi ini tanpa memancing pengulangan Resend', async () => {
    await kirimWebhook(peristiwa('resend-bukan-milik-kita', 'email.delivered')).expect(200);
    await kirimWebhook({ type: 'email.delivered' }).expect(200);
    await kirimWebhook({}).expect(200);
  });
});
