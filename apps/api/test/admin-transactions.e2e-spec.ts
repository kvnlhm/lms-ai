import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Transaksi pendaftaran untuk Master', () => {
  let h: Harness;
  let tierId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    const tier = await h.prisma.accessTier.findFirstOrThrow({ select: { id: true } });
    tierId = tier.id;

    const dasar = {
      tierId,
      phone: '628100000000',
      grossAmount: 250_000,
      expiresAt: new Date(Date.now() + 3_600_000),
    };
    const dibuat = await Promise.all([
      h.prisma.registrationOrder.create({
        data: { ...dasar, orderCode: `E2E-LUNAS-${Date.now()}`, fullName: 'Pembeli Lunas', email: `lunas-${Date.now()}@uji.test`, status: 'PAID', paidAt: new Date(), grossAmount: 250_000 },
        select: { id: true },
      }),
      h.prisma.registrationOrder.create({
        data: { ...dasar, orderCode: `E2E-TUNGGU-${Date.now()}`, fullName: 'Pembeli Menunggu', email: `tunggu-${Date.now()}@uji.test`, status: 'PENDING', grossAmount: 150_000 },
        select: { id: true },
      }),
      h.prisma.registrationOrder.create({
        data: { ...dasar, orderCode: `E2E-GAGAL-${Date.now()}`, fullName: 'Pembeli Gagal', email: `gagal-${Date.now()}@uji.test`, status: 'EXPIRED', grossAmount: 999_000 },
        select: { id: true },
      }),
    ]);
    orderIds.push(...dibuat.map((row) => row.id));
  });

  afterAll(async () => {
    await h.prisma.registrationOrder.deleteMany({ where: { id: { in: orderIds } } });
    await h.close();
  });

  it('menolak Pelajar melihat transaksi siapa pun', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await request(h.server)
      .get(`${prefix}/admin/registration-orders`)
      .set('Cookie', student.cookie)
      .expect(403);
    await request(h.server)
      .get(`${prefix}/admin/registration-orders/summary`)
      .set('Cookie', student.cookie)
      .expect(403);
  });

  it('menyaring menurut status di database, bukan menyerahkannya ke browser', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const lunas = await request(h.server)
      .get(`${prefix}/admin/registration-orders?status=PAID&pageSize=100`)
      .set('Cookie', master.cookie)
      .expect(200);
    const status = lunas.body.data.map((row: { status: string }) => row.status);
    expect(status.length).toBeGreaterThan(0);
    expect([...new Set(status)]).toEqual(['PAID']);
    // Meta paginasinya ikut menyempit; kalau tidak, pagernya akan menjanjikan
    // halaman yang isinya sudah tersaring habis.
    expect(lunas.body.meta.total).toBe(status.length);
  });

  it('mencari lewat kode pesanan, nama, dan email sekaligus', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const cari = await request(h.server)
      .get(`${prefix}/admin/registration-orders?search=Pembeli%20Menunggu`)
      .set('Cookie', master.cookie)
      .expect(200);
    expect(cari.body.data).toHaveLength(1);
    expect(cari.body.data[0].fullName).toBe('Pembeli Menunggu');
    // Nomor telepon dan nama paket ikut terkirim: keduanya yang dicari Master
    // saat seseorang mengaku sudah membayar.
    expect(cari.body.data[0].phone).toBe('628100000000');
    expect(typeof cari.body.data[0].tierName).toBe('string');
  });

  it('menghitung ringkasan dari seluruh pesanan, bukan dari satu halaman', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const satuBaris = await request(h.server)
      .get(`${prefix}/admin/registration-orders?pageSize=1`)
      .set('Cookie', master.cookie)
      .expect(200);
    expect(satuBaris.body.data).toHaveLength(1);

    const ringkasan = await request(h.server)
      .get(`${prefix}/admin/registration-orders/summary`)
      .set('Cookie', master.cookie)
      .expect(200);
    const data = ringkasan.body.data;
    expect(data.total).toBe(satuBaris.body.meta.total);
    expect(data.total).toBeGreaterThan(1);
    expect(data.paid + data.pending + data.failed).toBeLessThanOrEqual(data.total);
    // Pendapatan dijumlah hanya dari yang lunas. Dibandingkan dengan hitungan
    // langsung ke database, bukan sekadar "lebih besar dari sekian": pesanan
    // 999.000 yang kedaluwarsa tidak pernah menjadi uang, dan ikut
    // menjumlahkannya akan melaporkan pendapatan palsu.
    const lunasSaja = await h.prisma.registrationOrder.aggregate({
      where: { status: 'PAID' },
      _sum: { grossAmount: true },
    });
    const seluruhnya = await h.prisma.registrationOrder.aggregate({ _sum: { grossAmount: true } });
    expect(data.paidAmount).toBe(lunasSaja._sum.grossAmount ?? 0);
    expect(data.paidAmount).toBeLessThan(seluruhnya._sum.grossAmount ?? 0);
  });
});
