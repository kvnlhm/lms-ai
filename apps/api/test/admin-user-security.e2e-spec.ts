import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Pemulihan MFA oleh Master', () => {
  let h: Harness;

  beforeAll(async () => { h = await startHarness(); });

  afterAll(async () => {
    await h.prisma.mfaMethod.deleteMany({ where: { user: { email: STUDENT.email } } });
    await h.close();
  });

  /** Baris MFA dibuat langsung: pendaftaran lewat API hanya terbuka bagi Master. */
  async function pasangMfa(userId: string, verified: boolean) {
    await h.prisma.mfaMethod.deleteMany({ where: { userId } });
    await h.prisma.mfaMethod.create({
      data: {
        userId,
        type: 'TOTP',
        encryptedSecret: Buffer.from('rahasia-uji-yang-tidak-pernah-didekripsi'),
        verifiedAt: verified ? new Date() : null,
      },
    });
  }

  async function baris(cookie: string, email: string) {
    const response = await request(h.server)
      .get(`${prefix}/admin/users?page=1&pageSize=50&search=${encodeURIComponent(email)}`)
      .set('Cookie', cookie)
      .expect(200);
    return response.body.data.find((item: { email: string }) => item.email === email);
  }

  it('menyebut MFA aktif hanya setelah pendaftarannya diselesaikan', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const student = await h.prisma.user.findUniqueOrThrow({
      where: { email: STUDENT.email }, select: { id: true },
    });

    expect((await baris(master.cookie, STUDENT.email)).mfaEnabled).toBe(false);

    // Pendaftaran yang dimulai tetapi tidak pernah dikonfirmasi bukan
    // perlindungan; menyebutnya "aktif" akan menyesatkan Master.
    await pasangMfa(student.id, false);
    expect((await baris(master.cookie, STUDENT.email)).mfaEnabled).toBe(false);

    await pasangMfa(student.id, true);
    expect((await baris(master.cookie, STUDENT.email)).mfaEnabled).toBe(true);
  });

  it('reset menghapus MFA, mencabut sesi, dan meninggalkan jejak audit', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const student = await h.prisma.user.findUniqueOrThrow({
      where: { email: STUDENT.email }, select: { id: true },
    });
    await pasangMfa(student.id, true);

    // Sesi milik pelajar yang sedang berjalan; harus ikut dicabut.
    const sesiPelajar = await login(h.server, STUDENT.email, STUDENT.password);
    await request(h.server).get(`${prefix}/auth/me`).set('Cookie', sesiPelajar.cookie).expect(200);

    await request(h.server)
      .post(`${prefix}/admin/users/${student.id}/reset-mfa`)
      .set('Cookie', sesiPelajar.cookie)
      .set('X-CSRF-Token', sesiPelajar.csrfToken)
      .expect(403);

    await request(h.server)
      .post(`${prefix}/admin/users/${student.id}/reset-mfa`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(204);

    expect(await h.prisma.mfaMethod.count({ where: { userId: student.id } })).toBe(0);
    expect((await baris(master.cookie, STUDENT.email)).mfaEnabled).toBe(false);

    // Kehilangan perangkat berarti perangkatnya mungkin di tangan orang lain,
    // jadi sesi yang masih berjalan tidak boleh selamat dari pemulihan ini.
    await request(h.server).get(`${prefix}/auth/me`).set('Cookie', sesiPelajar.cookie).expect(401);

    const jejak = await h.prisma.auditLog.findFirst({
      where: { action: 'user.mfa_reset', targetId: student.id },
      select: { id: true },
    });
    expect(jejak).not.toBeNull();
  });

  it('menolak Master mereset MFA miliknya sendiri', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const diri = await h.prisma.user.findUniqueOrThrow({
      where: { email: MASTER.email }, select: { id: true },
    });

    const response = await request(h.server)
      .post(`${prefix}/admin/users/${diri.id}/reset-mfa`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(422);
    expect(JSON.stringify(response.body)).toContain('pemulihan akun');
  });
});
