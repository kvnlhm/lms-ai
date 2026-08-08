import { CommerceService } from './commerce.service';

/**
 * Checkout yang identitasnya dibuktikan Google.
 *
 * Google di sini hanya membuktikan siapa pendaftarnya; ia tidak memberi akses
 * apa pun. Akunnya tetap baru dibuat webhook pembayaran, sama seperti
 * pendaftaran biasa.
 */
describe('CommerceService.createCheckout dengan Google', () => {
  const IDENTITAS = { sub: 'sub-google-1', email: 'asli@gmail.com', name: 'Nama Dari Google' };

  function service(identitas: unknown = IDENTITAS) {
    const create = jest.fn().mockImplementation(({ data }) => ({ id: 'order-1', ...data }));
    const prisma = {
      accessTier: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tier-1', name: 'Paket Uji', priceIdr: 100000,
          promoCode: null, promoDiscountIdr: null, courses: [{ id: 'kursus-1' }],
        }),
      },
      registrationOrder: { create, update: jest.fn().mockResolvedValue({}) },
    };
    const midtrans = { createSnap: jest.fn().mockResolvedValue({ token: 'snap-1', redirect_url: 'https://midtrans/x' }) };
    const google = { periksa: jest.fn().mockResolvedValue(identitas), aktif: () => true };
    const config = { get: jest.fn().mockReturnValue({ commerce: { orderTtlMinutes: 60 } }) };
    const value = new CommerceService(
      prisma as never, {} as never, {} as never, midtrans as never, {} as never, config as never, google as never,
    );
    return { value, create, google };
  }

  const masukan = {
    tierId: 'tier-1',
    fullName: 'Nama Diketik',
    email: 'diketik@contoh.id',
    phone: '081234567890',
    termsAccepted: true,
  };

  test('memakai email dari Google, bukan yang diketik di formulir', async () => {
    // Celah yang ditutup di sini: masuk dengan akun Google sendiri lalu
    // mengetikkan email orang lain. Bila yang tersimpan adalah email ketikan,
    // webhook pembayaran akan menemukan akun berbayar milik orang itu dan
    // menautkan `googleSub` penyerang padanya.
    const { value, create } = service();

    await value.createCheckout({ ...masukan, googleIdToken: 'token-uji' } as never);

    expect(create.mock.calls[0][0].data).toMatchObject({
      email: 'asli@gmail.com',
      googleSub: 'sub-google-1',
    });
  });

  test('tetap menyimpan nomor telepon dari formulir; Google tidak memberikannya', async () => {
    const { value, create } = service();

    await value.createCheckout({ ...masukan, googleIdToken: 'token-uji' } as never);

    expect(create.mock.calls[0][0].data.phone).toBe('6281234567890');
  });

  test('menolak seluruh checkout ketika tokennya tidak sah, bukan diam-diam melanjutkan tanpa Google', async () => {
    // Melanjutkan tanpa Google berarti memakai email ketikan, yaitu persis
    // celah yang ditutup pada test di atas.
    const { value, create, google } = service();
    google.periksa = jest.fn().mockRejectedValue(Object.assign(new Error('token palsu'), { status: 401 }));

    await expect(value.createCheckout({ ...masukan, googleIdToken: 'palsu' } as never)).rejects.toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });

  test('tanpa token Google, pendaftaran biasa berjalan seperti semula', async () => {
    const { value, create, google } = service();

    await value.createCheckout(masukan as never);

    expect(google.periksa).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data).toMatchObject({
      email: 'diketik@contoh.id',
      fullName: 'Nama Diketik',
      googleSub: null,
    });
  });
});
