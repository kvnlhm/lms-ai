import { UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

/**
 * Masuk dengan Google.
 *
 * Yang dijaga di sini bukan verifikasi tokennya — itu milik
 * `GoogleIdentityService` — melainkan satu aturan produk yang tidak boleh
 * dilanggar: akun hanya lahir dari webhook pembayaran, tidak pernah dari
 * tombol masuk. Selama pendaftarnya belum membayar, tidak ada akun, dan
 * karena itu tidak ada sesi.
 */
describe('AuthService.loginWithGoogle', () => {
  const IDENTITAS = { sub: 'sub-google-1', email: 'pelajar@akademionline.id', name: 'Pelajar Uji' };

  const peranPelajar = {
    role: { code: 'STUDENT', permissions: [] },
  };

  function service(user: unknown, overrides: Record<string, unknown> = {}) {
    const findFirst = jest.fn().mockResolvedValue(user);
    const update = jest.fn().mockResolvedValue({});
    const create = jest.fn();
    const prisma = {
      user: { findFirst, update, create },
      authSession: { create: jest.fn().mockResolvedValue({ id: 'perangkat-1' }) },
      ...overrides,
    };
    const sessions = { create: jest.fn().mockResolvedValue({ sessionId: 'sesi-1', csrfToken: 'csrf-1' }) };
    const google = { periksa: jest.fn().mockResolvedValue(IDENTITAS), aktif: () => true };
    const config = {
      get: jest.fn().mockReturnValue({
        auth: { requireMasterMfa: false, googleClientId: 'klien-uji' },
        session: { absoluteTtlSeconds: 3600 },
      }),
    };
    const value = new AuthService(
      prisma as never,
      {} as never,
      sessions as never,
      {} as never,
      { isEnabled: jest.fn().mockResolvedValue(false) } as never,
      {} as never,
      {} as never,
      {} as never,
      { record: jest.fn() } as never,
      config as never,
      google as never,
    );
    return { value, prisma, sessions, google, create, update, findFirst };
  }

  const akun = (extra: Record<string, unknown> = {}) => ({
    id: 'pengguna-1',
    email: IDENTITAS.email,
    fullName: 'Pelajar Uji',
    status: UserStatus.ACTIVE,
    passwordHash: 'tidak-terpakai',
    googleSub: 'sub-google-1',
    roles: [peranPelajar],
    ...extra,
  });

  const perintah = { idToken: 'token-uji', ipAddress: '10.0.0.1', userAgent: 'uji', deviceName: 'Uji' };

  test('menerbitkan sesi untuk akun yang sudah tertaut', async () => {
    const { value, sessions } = service(akun());

    await expect(value.loginWithGoogle(perintah)).resolves.toMatchObject({
      sessionId: 'sesi-1',
      csrfToken: 'csrf-1',
      user: { id: 'pengguna-1', role: 'STUDENT' },
    });
    expect(sessions.create).toHaveBeenCalled();
  });

  test('menolak dan TIDAK membuat akun ketika belum ada yang cocok', async () => {
    // Inilah aturannya: selama belum membayar, akunnya belum dibuat webhook,
    // jadi tidak ada yang boleh masuk. Tombol Google tidak boleh menjadi pintu
    // kedua yang membuat akun sendiri.
    const { value, create, sessions } = service(null);

    await expect(value.loginWithGoogle(perintah)).rejects.toMatchObject({ status: 401 });
    expect(create).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  test('menautkan akun berbayar yang emailnya sama tetapi belum punya googleSub', async () => {
    const { value, update, sessions } = service(akun({ googleSub: null }));

    await expect(value.loginWithGoogle(perintah)).resolves.toMatchObject({ sessionId: 'sesi-1' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pengguna-1' },
      data: expect.objectContaining({ googleSub: 'sub-google-1' }),
    }));
    expect(sessions.create).toHaveBeenCalled();
  });

  test('menolak akun yang ditangguhkan, sama seperti masuk dengan kata sandi', async () => {
    const { value, sessions } = service(akun({ status: UserStatus.SUSPENDED }));

    await expect(value.loginWithGoogle(perintah)).rejects.toMatchObject({ status: 403 });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  test('menolak akun yang nonaktif', async () => {
    const { value, sessions } = service(akun({ status: UserStatus.INACTIVE }));

    await expect(value.loginWithGoogle(perintah)).rejects.toMatchObject({ status: 403 });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  test('menolak token yang tidak lolos verifikasi, tanpa menyentuh basis data', async () => {
    const { value, google, findFirst } = service(akun());
    google.periksa = jest.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 401 }));

    await expect(value.loginWithGoogle(perintah)).rejects.toBeDefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  test('mencari berdasarkan googleSub maupun email, dan mengabaikan akun terhapus', async () => {
    const { value, findFirst } = service(akun());

    await value.loginWithGoogle(perintah);

    const where = findFirst.mock.calls[0][0].where as { deletedAt: null; OR: unknown[] };
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toEqual(
      expect.arrayContaining([{ googleSub: 'sub-google-1' }, { email: 'pelajar@akademionline.id' }]),
    );
  });
});
