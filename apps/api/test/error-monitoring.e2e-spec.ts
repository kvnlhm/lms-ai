import request from 'supertest';
import { login, prefix, startHarness, type Harness, type Session } from './support/harness';

// Peringatan email tidak diuji di sini; yang diuji adalah pencatatan,
// pengelompokan, dan siapa yang boleh membacanya.
process.env.EMAIL_PROVIDER = 'DISABLED';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Pemantauan galat', () => {
  let h: Harness;
  let master: Session;

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    await h.prisma.errorEvent.deleteMany({});
    const keys = await h.redis.keys('*client-error:*');
    if (keys.length > 0) await h.redis.del(...keys);
  });

  describe('laporan dari browser', () => {
    it('menerima laporan tanpa perlu sesi', async () => {
      await request(h.server)
        .post(`${prefix}/telemetry/client-errors`)
        .send({ type: 'TypeError', message: 'x.map bukan fungsi', path: '/courses' })
        .expect(202);

      const rows = await h.prisma.errorEvent.findMany({});
      expect(rows).toHaveLength(1);
      expect(rows[0]!.source).toBe('WEB');
      expect(rows[0]!.status).toBe('OPEN');
    });

    it('menggabungkan laporan yang sebenarnya satu masalah', async () => {
      const kirim = (message: string) =>
        request(h.server)
          .post(`${prefix}/telemetry/client-errors`)
          .send({ type: 'TypeError', message, path: '/courses' })
          .expect(202);

      // Pesan berbeda hanya pada ID-nya: satu bug, bukan tiga.
      await kirim('Kursus 3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b tidak ada');
      await kirim('Kursus 9b1c2d3e-4f50-6a7b-8c9d-0e1f2a3b4c5d tidak ada');
      await kirim('Kursus 11112222-3333-4444-5555-666677778888 tidak ada');

      const rows = await h.prisma.errorEvent.findMany({});
      expect(rows).toHaveLength(1);
      expect(rows[0]!.occurrences).toBe(3);
    });

    it('menolak payload yang tidak sesuai bentuk', async () => {
      await request(h.server)
        .post(`${prefix}/telemetry/client-errors`)
        .send({ message: 'tanpa type' })
        .expect(422);

      await request(h.server)
        .post(`${prefix}/telemetry/client-errors`)
        .send({ type: 'Error', message: 'x', source: 'API' })
        .expect(422);
    });

    it('memotong pesan yang melampaui batas', async () => {
      await request(h.server)
        .post(`${prefix}/telemetry/client-errors`)
        .send({ type: 'Error', message: 'x'.repeat(600) })
        .expect(422);
    });

    it('membatasi jumlah laporan per IP', async () => {
      const limit = Number.parseInt(process.env.CLIENT_ERROR_MAX_PER_HOUR ?? '30', 10);

      for (let i = 0; i < limit; i += 1) {
        await request(h.server)
          .post(`${prefix}/telemetry/client-errors`)
          .send({ type: 'Error', message: `galat nomor ${i}` })
          .expect(202);
      }

      // Tanpa pagar ini satu skrip cukup untuk menggelembungkan tabel galat.
      await request(h.server)
        .post(`${prefix}/telemetry/client-errors`)
        .send({ type: 'Error', message: 'satu lagi' })
        .expect(429);
    });
  });

  describe('daftar untuk Master', () => {
    beforeEach(async () => {
      await request(h.server)
        .post(`${prefix}/telemetry/client-errors`)
        .send({ type: 'TypeError', message: 'gagal render', path: '/courses' })
        .expect(202);
    });

    it('menampilkan galat kepada pemegang audit.read', async () => {
      const response = await request(h.server)
        .get(`${prefix}/admin/errors`)
        .set('Cookie', master.cookie)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('TypeError');
      // BigInt tidak dapat diserialkan ke JSON; id wajib berupa string.
      expect(typeof response.body.data[0].id).toBe('string');
    });

    it('menolak pelajar', async () => {
      const student = await login(h.server, STUDENT.email, STUDENT.password);
      await request(h.server)
        .get(`${prefix}/admin/errors`)
        .set('Cookie', student.cookie)
        .expect(403);
    });

    it('menolak permintaan tanpa sesi', async () => {
      await request(h.server).get(`${prefix}/admin/errors`).expect(401);
    });

    it('menyaring berdasarkan sumber', async () => {
      const kosong = await request(h.server)
        .get(`${prefix}/admin/errors?source=WORKER`)
        .set('Cookie', master.cookie)
        .expect(200);
      expect(kosong.body.data).toHaveLength(0);

      const ada = await request(h.server)
        .get(`${prefix}/admin/errors?source=WEB`)
        .set('Cookie', master.cookie)
        .expect(200);
      expect(ada.body.data).toHaveLength(1);
    });

    it('menghitung ringkasan', async () => {
      const response = await request(h.server)
        .get(`${prefix}/admin/errors/summary`)
        .set('Cookie', master.cookie)
        .expect(200);

      expect(response.body.data).toEqual({ open: 1, resolved: 0, lastDay: 1 });
    });
  });

  describe('menutup dan membuka kembali', () => {
    async function idGalatPertama(): Promise<string> {
      await request(h.server)
        .post(`${prefix}/telemetry/client-errors`)
        .send({ type: 'TypeError', message: 'gagal render', path: '/courses' })
        .expect(202);
      const row = await h.prisma.errorEvent.findFirstOrThrow({});
      return row.id.toString();
    }

    it('menandai galat selesai beserta siapa yang menutupnya', async () => {
      const id = await idGalatPertama();

      const response = await request(h.server)
        .post(`${prefix}/admin/errors/${id}/resolve`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .expect(200);

      expect(response.body.data.status).toBe('RESOLVED');
      const row = await h.prisma.errorEvent.findFirstOrThrow({});
      expect(row.resolvedBy).toBe(master.userId);
    });

    it('membuka galat kembali ketika terulang setelah ditutup', async () => {
      const id = await idGalatPertama();
      await request(h.server)
        .post(`${prefix}/admin/errors/${id}/resolve`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .expect(200);

      await request(h.server)
        .post(`${prefix}/telemetry/client-errors`)
        .send({ type: 'TypeError', message: 'gagal render', path: '/courses' })
        .expect(202);

      // Menutup galat bukan janji bahwa ia tidak akan kembali; kalau kembali,
      // ia harus terlihat lagi tanpa menunggu ada yang mengeceknya.
      const row = await h.prisma.errorEvent.findFirstOrThrow({});
      expect(row.status).toBe('OPEN');
      expect(row.resolvedBy).toBeNull();
    });

    it('membalas 404 untuk id yang tidak ada', async () => {
      await request(h.server)
        .post(`${prefix}/admin/errors/999999/resolve`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .expect(404);
    });

    it('membalas 404 untuk id yang bukan angka', async () => {
      await request(h.server)
        .post(`${prefix}/admin/errors/bukan-angka/resolve`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .expect(404);
    });

    it('menolak penutupan tanpa token CSRF', async () => {
      const id = await idGalatPertama();
      await request(h.server)
        .post(`${prefix}/admin/errors/${id}/resolve`)
        .set('Cookie', master.cookie)
        .expect(403);
    });
  });
});
