import request from 'supertest';
import { prefix, startHarness, type Harness } from './support/harness';

/**
 * Masuk dengan Google, dari sisi HTTP.
 *
 * Token Google sungguhan tidak dapat dibuat di dalam test, jadi yang dibuktikan
 * di sini bukan verifikasinya — itu milik spec unit — melainkan tiga hal yang
 * hanya terlihat pada aplikasi yang menyala: rutenya ada, ia dapat dicapai
 * tanpa sesi, dan ketika `GOOGLE_OAUTH_CLIENT_ID` kosong ia menolak alih-alih
 * menerima apa adanya.
 */
describe('Masuk dengan Google', () => {
  let h: Harness;

  beforeAll(async () => {
    // Sengaja dikosongkan: inilah keadaan sebelum pemiliknya mendaftarkan
    // aplikasi di Google Cloud Console.
    process.env.GOOGLE_OAUTH_CLIENT_ID = '';
    h = await startHarness();
  });

  afterAll(async () => { await h.close(); });

  it('dapat dicapai tanpa sesi, tetapi menolak ketika belum dikonfigurasi', async () => {
    const response = await request(h.server)
      .post(`${prefix}/auth/google`)
      .send({ idToken: 'token-yang-tidak-pernah-sah-tetapi-cukup-panjang' })
      .expect(401);

    // 401 dan bukan 403: rutenya publik dan memang tercapai, yang gagal
    // pembuktian identitasnya. 403 berarti guard sesi yang menolak, tanda
    // `@Public()` terlupa.
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('menolak payload tanpa idToken sebagai galat validasi', async () => {
    const response = await request(h.server).post(`${prefix}/auth/google`).send({}).expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('tidak membuat akun apa pun dari percobaan yang gagal', async () => {
    const sebelum = await h.prisma.user.count();

    await request(h.server)
      .post(`${prefix}/auth/google`)
      .send({ idToken: 'percobaan-lain-yang-juga-tidak-sah' })
      .expect(401);

    // Aturan yang paling penting dari fitur ini: tombol Google tidak pernah
    // menjadi jalan membuat akun. Akun hanya lahir dari webhook pembayaran.
    expect(await h.prisma.user.count()).toBe(sebelum);
  });
});
