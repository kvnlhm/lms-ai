import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };

describe('Paket akses', () => {
  let h: Harness;
  let master: Awaited<ReturnType<typeof login>>;
  const dibuat: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
  });

  afterAll(async () => {
    for (const id of dibuat) {
      await h.prisma.accessTierCourse.deleteMany({ where: { tierId: id } });
      await h.prisma.accessTier.deleteMany({ where: { id } });
    }
    await h.close();
  });

  function asMaster(method: 'get' | 'post' | 'patch', path: string) {
    return request(h.server)
      [method](`${prefix}${path}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken);
  }

  let courseId = '';

  async function buatPaket(body: Record<string, unknown>) {
    if (!courseId) {
      const kursus = await h.prisma.course.findFirstOrThrow({ select: { id: true } });
      courseId = kursus.id;
    }
    const response = await asMaster('post', '/admin/access-tiers').send({
      name: 'Paket Uji',
      slug: `uji-paket-${Date.now()}-${Math.floor(performance.now())}`,
      priceIdr: 1_000_000,
      courseIds: [courseId],
      ...body,
    });
    if (response.status === 201) dibuat.push(response.body.data.id);
    return response;
  }

  it('menyimpan dan mengembalikan harga normal', async () => {
    // Validasi API memakai forbidNonWhitelisted: nama kolom yang meleset
    // menolak seluruh permintaan alih-alih mengabaikan kolomnya.
    const response = await buatPaket({ originalPriceIdr: 2_500_000 });
    expect(response.status).toBe(201);
    expect(response.body.data.originalPriceIdr).toBe(2_500_000);

    const detail = await asMaster('get', '/admin/access-tiers').expect(200);
    const tersimpan = (detail.body.data as Array<{ id: string; originalPriceIdr: number | null }>)
      .find((item) => item.id === response.body.data.id);
    expect(tersimpan?.originalPriceIdr).toBe(2_500_000);
  });

  it('memperlakukan harga normal sebagai opsional', async () => {
    const response = await buatPaket({});
    expect(response.status).toBe(201);
    expect(response.body.data.originalPriceIdr).toBeNull();
  });

  it('menolak harga normal yang tidak lebih tinggi dari harga jual', async () => {
    // Coretan hanya berarti bila memang ada potongan. Angka yang sama atau
    // lebih rendah akan menjanjikan diskon yang tidak ada.
    const sama = await buatPaket({ priceIdr: 900_000, originalPriceIdr: 900_000 });
    expect(sama.status).toBe(422);
    expect(sama.body.error.fields.originalPriceIdr).toBeDefined();

    const lebihRendah = await buatPaket({ priceIdr: 900_000, originalPriceIdr: 500_000 });
    expect(lebihRendah.status).toBe(422);
  });

  it('menolak penurunan harga jual yang membuat harga normal tidak masuk akal', async () => {
    const paket = await buatPaket({ priceIdr: 1_000_000, originalPriceIdr: 1_500_000 });
    expect(paket.status).toBe(201);

    // Hanya harga jualnya yang dikirim. Tanpa membandingkan terhadap nilai
    // yang sudah tersimpan, perubahan ini akan lolos dan meninggalkan harga
    // normal yang lebih rendah dari harga jualnya.
    const response = await asMaster('patch', `/admin/access-tiers/${paket.body.data.id}`)
      .send({ priceIdr: 2_000_000 })
      .expect(422);
    expect(response.body.error.fields.originalPriceIdr).toBeDefined();
  });

  it('menyertakan harga normal pada daftar paket untuk calon pembeli', async () => {
    const dibuatPaket = await buatPaket({ originalPriceIdr: 3_000_000, isActive: true });
    expect(dibuatPaket.status).toBe(201);

    const publik = await request(h.server).get(`${prefix}/registration/tiers`).expect(200);
    const semua = publik.body.data as Array<{ originalPriceIdr: number | null }>;
    expect(semua.some((tier) => tier.originalPriceIdr === 3_000_000)).toBe(true);
  });
});
