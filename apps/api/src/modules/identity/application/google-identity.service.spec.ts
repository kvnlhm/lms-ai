import { GoogleIdentityService } from './google-identity.service';

/**
 * Verifikasi tanda tangan dan `aud` adalah tanggung jawab `google-auth-library`
 * dan tidak diuji ulang di sini. Yang diuji adalah keputusan yang menjadi milik
 * kita: kapan sebuah token yang sah tetap ditolak.
 */
describe('GoogleIdentityService', () => {
  const KLAIM = {
    sub: '110111213141516171819',
    email: 'Calon@Gmail.com',
    email_verified: true,
    name: 'Calon Pelajar',
  };

  function service(klaim: unknown, clientId = 'klien-uji.apps.googleusercontent.com') {
    const verifyIdToken = jest.fn().mockResolvedValue({ getPayload: () => klaim });
    const config = { get: jest.fn().mockReturnValue({ auth: { googleClientId: clientId } }) };
    const value = new GoogleIdentityService(config as never);
    // Klien Google digantikan tiruan; yang diuji keputusan sesudah verifikasi.
    (value as unknown as { klien: { verifyIdToken: unknown } }).klien = { verifyIdToken };
    return { value, verifyIdToken };
  }

  test('menuntut ID token diperiksa terhadap client id kita sebagai audience', async () => {
    // Tanpa `audience`, token yang diterbitkan untuk aplikasi lain ikut lolos.
    const { value, verifyIdToken } = service(KLAIM);

    await value.periksa('token-uji');

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'token-uji',
      audience: 'klien-uji.apps.googleusercontent.com',
    });
  });

  test('mengembalikan sub dan email yang sudah dinormalkan huruf kecil', async () => {
    // Kolom email memang citext, tetapi nilai yang dibandingkan di kode tidak.
    const { value } = service(KLAIM);

    await expect(value.periksa('token-uji')).resolves.toEqual({
      sub: '110111213141516171819',
      email: 'calon@gmail.com',
      name: 'Calon Pelajar',
    });
  });

  test('menolak token yang emailnya belum diverifikasi Google', async () => {
    // Inilah satu-satunya yang menahan pengambilalihan akun: tanpa pemeriksaan
    // ini, siapa pun yang dapat membuat akun Google beralamat email korban
    // memperoleh akun berbayarnya.
    const { value } = service({ ...KLAIM, email_verified: false });

    await expect(value.periksa('token-uji')).rejects.toMatchObject({ status: 401 });
  });

  test('menolak token tanpa email sama sekali', async () => {
    const { value } = service({ sub: KLAIM.sub, email_verified: true });

    await expect(value.periksa('token-uji')).rejects.toMatchObject({ status: 401 });
  });

  test('menolak token tanpa sub', async () => {
    const { value } = service({ email: KLAIM.email, email_verified: true });

    await expect(value.periksa('token-uji')).rejects.toMatchObject({ status: 401 });
  });

  test('menolak ketika client id belum dikonfigurasi, bukan menerima apa adanya', async () => {
    // Salah arah yang paling mudah terjadi saat deploy: variabelnya lupa diisi
    // dan tombolnya tetap tampil. Yang benar adalah menolak.
    const { value, verifyIdToken } = service(KLAIM, '');

    await expect(value.periksa('token-uji')).rejects.toMatchObject({ status: 401 });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test('menolak ketika pustaka Google menyatakan token tidak sah', async () => {
    const { value } = service(KLAIM);
    (value as unknown as { klien: { verifyIdToken: unknown } }).klien = {
      verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid token signature')),
    };

    await expect(value.periksa('token-palsu')).rejects.toMatchObject({ status: 401 });
  });

  test('aktif hanya bila client id terisi', () => {
    expect(service(KLAIM).value.aktif()).toBe(true);
    expect(service(KLAIM, '').value.aktif()).toBe(false);
  });
});
