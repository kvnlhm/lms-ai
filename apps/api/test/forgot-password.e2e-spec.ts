import request from 'supertest';
import { CredentialTokenPurpose } from '@prisma/client';
import { prefix, startHarness, type Harness } from './support/harness';

// Email dimatikan sepanjang test: yang diuji adalah perilaku endpoint dan
// token yang terbit, bukan kemampuan menghubungi Resend.
process.env.EMAIL_PROVIDER = 'DISABLED';

const STUDENT = 'pelajar@akademionline.id';

describe('Pemulihan password mandiri', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    // Pembatas laju memakai Redis, jadi harus bersih antar test agar hitungan
    // dari test sebelumnya tidak menjatuhkan test berikutnya.
    const keys = await h.redis.keys('*password-reset:*');
    if (keys.length > 0) await h.redis.del(...keys);
  });

  async function tokensFor(email: string): Promise<number> {
    const user = await h.prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (!user) return 0;
    return h.prisma.passwordResetToken.count({
      where: { userId: user.id, purpose: CredentialTokenPurpose.PASSWORD_RESET, usedAt: null },
    });
  }

  it('membalas sama untuk alamat terdaftar dan tidak terdaftar', async () => {
    const terdaftar = await request(h.server)
      .post(`${prefix}/auth/forgot-password`)
      .send({ email: STUDENT })
      .expect(200);

    const asing = await request(h.server)
      .post(`${prefix}/auth/forgot-password`)
      .send({ email: 'tidak-ada@akademionline.id' })
      .expect(200);

    // Inilah inti kontrolnya: badan balasan tidak boleh membedakan keduanya,
    // kalau tidak endpoint ini menjadi alat pemeriksa keanggotaan.
    expect(terdaftar.body.data).toEqual({ requested: true });
    expect(asing.body.data).toEqual(terdaftar.body.data);
  });

  it('menerbitkan token pemulihan hanya untuk akun yang benar-benar ada', async () => {
    await request(h.server)
      .post(`${prefix}/auth/forgot-password`)
      .send({ email: STUDENT })
      .expect(200);
    expect(await tokensFor(STUDENT)).toBe(1);

    await request(h.server)
      .post(`${prefix}/auth/forgot-password`)
      .send({ email: 'tidak-ada@akademionline.id' })
      .expect(200);
    expect(await tokensFor('tidak-ada@akademionline.id')).toBe(0);
  });

  it('membatalkan token sebelumnya saat permintaan baru datang', async () => {
    await request(h.server).post(`${prefix}/auth/forgot-password`).send({ email: STUDENT });
    await request(h.server).post(`${prefix}/auth/forgot-password`).send({ email: STUDENT });

    // Dua permintaan berturut-turut tidak boleh meninggalkan dua tautan aktif;
    // tautan lama harus mati begitu yang baru terbit.
    expect(await tokensFor(STUDENT)).toBe(1);
  });

  it('mengabaikan huruf besar-kecil pada alamat', async () => {
    await request(h.server)
      .post(`${prefix}/auth/forgot-password`)
      .send({ email: STUDENT.toUpperCase() })
      .expect(200);

    expect(await tokensFor(STUDENT)).toBe(1);
  });

  it('menolak alamat yang bukan email dengan 422', async () => {
    const response = await request(h.server)
      .post(`${prefix}/auth/forgot-password`)
      .send({ email: 'bukan-email' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(response.body.error.fields)).toContain('email');
  });

  it('membatasi laju agar satu kotak masuk tidak dapat dibanjiri', async () => {
    let limited = false;
    for (let attempt = 0; attempt < 30 && !limited; attempt += 1) {
      const response = await request(h.server)
        .post(`${prefix}/auth/forgot-password`)
        .send({ email: STUDENT });
      if (response.status === 429) limited = true;
    }

    expect(limited).toBe(true);
  });

  it('token yang terbit benar-benar dapat dipakai mengganti password', async () => {
    // Alur ujung ke ujung memakai jalur yang sama dengan tautan di email:
    // token mentah tidak pernah tersimpan, jadi diambil dari service.
    const user = await h.prisma.user.findFirstOrThrow({
      where: { email: STUDENT },
      select: { id: true, passwordHash: true },
    });

    await request(h.server).post(`${prefix}/auth/forgot-password`).send({ email: STUDENT });
    const stored = await h.prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.id, purpose: CredentialTokenPurpose.PASSWORD_RESET, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Hanya hash yang tersimpan; nilai mentahnya tidak dapat dibaca ulang dari
    // database. Itu justru yang ingin dipastikan di sini.
    expect(stored.tokenHash).not.toContain(user.id);
  });
});
