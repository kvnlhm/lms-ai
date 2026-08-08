import { CredentialTokenPurpose, UserStatus } from '@prisma/client';
import { FreeRegistrationService } from './free-registration.service';

function buat({
  emailTerpakai = false,
  emailTerverifikasi = false,
}: { emailTerpakai?: boolean; emailTerverifikasi?: boolean } = {}) {
  const pengguna = emailTerpakai
    ? {
        id: 'user-1',
        fullName: 'Sudah Ada',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: emailTerverifikasi ? new Date() : null,
      }
    : null;

  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'user-baru', fullName: 'Pendaftar' }) },
    userRole: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(pengguna),
      update: jest.fn().mockResolvedValue({ id: 'user-1' }),
    },
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-student' }) },
    $transaction: jest.fn(async (jalankan: (client: typeof tx) => unknown) => jalankan(tx)),
  };
  const passwords = { hash: jest.fn().mockResolvedValue('hash-sandi') };
  const tokens = {
    issue: jest.fn().mockResolvedValue({ token: 'token-mentah', expiresAt: new Date() }),
    consume: jest.fn().mockResolvedValue({ userId: 'user-1' }),
  };
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const rateLimiter = { consume: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { get: () => ({ web: { url: 'https://academy.test' }, auth: {} }) };

  const service = new FreeRegistrationService(
    prisma as never,
    passwords as never,
    tokens as never,
    email as never,
    rateLimiter as never,
    audit as never,
    config as never,
  );
  return { service, prisma, passwords, tokens, email, rateLimiter, tx };
}

describe('FreeRegistrationService daftar', () => {
  const masukan = {
    fullName: 'Pendaftar Baru',
    email: 'baru@example.com',
    password: 'Sandi#Kuat12345',
    ipAddress: '1.2.3.4',
  };

  it('membuat akun tanpa pesanan dan tanpa enrollment', async () => {
    const { service, tx, passwords } = buat();

    await service.daftar(masukan);

    expect(passwords.hash).toHaveBeenCalledWith(masukan.password);
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data.email).toBe('baru@example.com');
    // Belum terbukti sampai tautannya dibuka.
    expect(data.emailVerifiedAt).toBeNull();
    expect(tx.userRole.create).toHaveBeenCalled();
  });

  it('mengirim tautan verifikasi ke alamat yang didaftarkan', async () => {
    const { service, tokens, email } = buat();

    await service.daftar(masukan);

    expect(tokens.issue).toHaveBeenCalledWith('user-baru', CredentialTokenPurpose.EMAIL_VERIFICATION);
    const dikirim = email.send.mock.calls[0][0];
    expect(dikirim.to).toBe('baru@example.com');
    expect(dikirim.html).toContain('token-mentah');
  });

  it('menjawab sama untuk alamat yang sudah terpakai', async () => {
    // Balasan yang berbeda mengubah formulir pendaftaran menjadi alat memeriksa
    // siapa saja yang punya akun di sini.
    const { service, tx } = buat({ emailTerpakai: true });

    await expect(service.daftar(masukan)).resolves.toEqual({ registered: true });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('mengirim ulang tautan bila alamatnya terpakai tetapi belum terbukti', async () => {
    // Orang yang mendaftar dua kali karena emailnya tidak sampai harus tertolong,
    // bukan dibiarkan menunggu tautan yang tidak akan datang.
    const { service, email } = buat({ emailTerpakai: true, emailTerverifikasi: false });

    await service.daftar(masukan);

    expect(email.send).toHaveBeenCalled();
  });

  it('tidak mengirim apa pun bila alamatnya sudah terbukti', async () => {
    const { service, email } = buat({ emailTerpakai: true, emailTerverifikasi: true });

    await service.daftar(masukan);

    expect(email.send).not.toHaveBeenCalled();
  });

  it('melewati pembatasan laju sebelum menyentuh basis data', async () => {
    const { service, rateLimiter } = buat();

    await service.daftar(masukan);

    expect(rateLimiter.consume).toHaveBeenCalledWith('1.2.3.4', 'baru@example.com');
  });
});

describe('FreeRegistrationService verifikasi', () => {
  it('menandai email terbukti saat tokennya sah', async () => {
    const { service, prisma } = buat();

    await expect(service.verifikasi('token-mentah')).resolves.toEqual({ verified: true });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('menolak token yang tidak sah tanpa menyentuh akun', async () => {
    const { service, prisma, tokens } = buat();
    (tokens.consume as jest.Mock).mockResolvedValue(null);

    await expect(service.verifikasi('token-palsu')).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
