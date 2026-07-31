import request from 'supertest';

// Dinyalakan sebelum harness memuat konfigurasi. Spec lain sengaja
// mematikannya karena 230 test dari satu alamat akan menabrak batasnya.
process.env.RATE_LIMIT_ENABLED = 'true';
process.env.RATE_LIMIT_MAX = '8';
process.env.RATE_LIMIT_WINDOW_SECONDS = '60';

// eslint-disable-next-line import/first
import { login, prefix, startHarness, type Harness, type Session } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };

describe('Pembatas laju global', () => {
  let h: Harness;
  let master: Session;

  beforeAll(async () => {
    h = await startHarness();
    await bersihkan();
    master = await login(h.server, MASTER.email, MASTER.password);
  });

  afterAll(async () => {
    await h.close();
  });

  async function bersihkan(): Promise<void> {
    const keys = await h.redis.keys('*ratelimit:*');
    if (keys.length > 0) await h.redis.del(...keys);
  }

  beforeEach(bersihkan);

  it('menolak setelah anggaran habis', async () => {
    for (let i = 0; i < 8; i += 1) {
      await request(h.server).get(`${prefix}/health/live`).expect(200);
    }

    // health/live dibebaskan, jadi delapan permintaan tadi tidak menghabiskan
    // anggaran apa pun. Endpoint biasa yang dihitung.
    for (let i = 0; i < 8; i += 1) {
      await request(h.server).get(`${prefix}/auth/me`).set('Cookie', master.cookie).expect(200);
    }

    const ditolak = await request(h.server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', master.cookie)
      .expect(429);

    expect(ditolak.body.error.code).toBe('RATE_LIMITED');
    expect(ditolak.headers['retry-after']).toBe('60');
  });

  it('membebaskan health check yang dipolling mesin', async () => {
    // Coolify memanggil ini terus-menerus; menghitungnya akan membuat
    // pemantauan sendiri yang menjatuhkan situs.
    for (let i = 0; i < 30; i += 1) {
      await request(h.server).get(`${prefix}/health/live`).expect(200);
    }
  });

  it('melindungi jalur login yang belum punya sesi', async () => {
    for (let i = 0; i < 8; i += 1) {
      await request(h.server)
        .post(`${prefix}/auth/forgot-password`)
        .send({ email: 'siapa@akademionline.id' });
    }

    // Guard ini berjalan sebelum sesi diperiksa; pembatas yang baru bekerja
    // setelah autentikasi tidak menolong ketika yang dibanjiri halaman masuk.
    await request(h.server)
      .post(`${prefix}/auth/forgot-password`)
      .send({ email: 'siapa@akademionline.id' })
      .expect(429);
  });

  it('memberi tahu sisa anggaran lewat header', async () => {
    const response = await request(h.server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBe('8');
    expect(Number(response.headers['x-ratelimit-remaining'])).toBeLessThan(8);
  });

  it('memakai anggaran terpisah untuk pencarian', async () => {
    // Pencarian punya @RateLimit sendiri, jadi menghabiskan anggaran umum
    // tidak boleh ikut menutup pencarian — dan sebaliknya.
    for (let i = 0; i < 8; i += 1) {
      await request(h.server).get(`${prefix}/auth/me`).set('Cookie', master.cookie);
    }
    await request(h.server).get(`${prefix}/auth/me`).set('Cookie', master.cookie).expect(429);

    await request(h.server)
      .get(`${prefix}/search?q=kursus`)
      .set('Cookie', master.cookie)
      .expect(200);
  });
});
