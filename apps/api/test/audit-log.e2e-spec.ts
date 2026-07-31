import request from 'supertest';
import { login, prefix, startHarness, type Harness, type Session } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Penampil audit log', () => {
  let h: Harness;
  let master: Session;

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
  });

  afterAll(async () => {
    await h.close();
  });

  /** Menyisipkan catatan langsung; yang diuji sisi bacanya, bukan pemicunya. */
  async function catat(overrides: Partial<{
    action: string;
    targetType: string;
    targetId: string | null;
    createdAt: Date;
  }> = {}) {
    return h.prisma.auditLog.create({
      data: {
        actorUserId: master.userId,
        action: overrides.action ?? 'user.updated',
        targetType: overrides.targetType ?? 'User',
        targetId: overrides.targetId ?? null,
        beforeData: { status: 'ACTIVE' },
        afterData: { status: 'SUSPENDED' },
        requestId: '11112222-3333-4444-5555-666677778888',
        ipAddress: '203.0.113.9',
        userAgent: 'jest',
        ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      },
    });
  }

  beforeEach(async () => {
    await h.prisma.auditLog.deleteMany({});
  });

  it('menolak pelajar', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await request(h.server)
      .get(`${prefix}/admin/audit-logs`)
      .set('Cookie', student.cookie)
      .expect(403);
  });

  it('menolak permintaan tanpa sesi', async () => {
    await request(h.server).get(`${prefix}/admin/audit-logs`).expect(401);
  });

  it('menampilkan catatan beserta pelakunya', async () => {
    await catat();

    const response = await request(h.server)
      .get(`${prefix}/admin/audit-logs`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    const entry = response.body.data[0];
    // BigInt tidak dapat diserialkan ke JSON; id wajib berupa string.
    expect(typeof entry.id).toBe('string');
    expect(entry.action).toBe('user.updated');
    expect(entry.actor.email).toBe(MASTER.email);
    expect(entry.beforeData).toEqual({ status: 'ACTIVE' });
    expect(entry.ipAddress).toBe('203.0.113.9');
  });

  it('mengurutkan yang terbaru lebih dulu', async () => {
    await catat({ action: 'user.lama', createdAt: new Date(Date.now() - 86_400_000) });
    await catat({ action: 'user.baru' });

    const response = await request(h.server)
      .get(`${prefix}/admin/audit-logs`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data.map((entry: { action: string }) => entry.action)).toEqual([
      'user.baru',
      'user.lama',
    ]);
  });

  it('menyaring tindakan berdasarkan awalan', async () => {
    await catat({ action: 'user.deleted' });
    await catat({ action: 'course.published' });

    const response = await request(h.server)
      .get(`${prefix}/admin/audit-logs?action=user.`)
      .set('Cookie', master.cookie)
      .expect(200);

    // Awalan, bukan kecocokan penuh: satu penyaring cukup untuk seluruh
    // tindakan atas pengguna.
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].action).toBe('user.deleted');
  });

  it('menyaring berdasarkan rentang waktu', async () => {
    await catat({ action: 'user.lama', createdAt: new Date(Date.now() - 7 * 86_400_000) });
    await catat({ action: 'user.baru' });

    const from = new Date(Date.now() - 86_400_000).toISOString();
    const response = await request(h.server)
      .get(`${prefix}/admin/audit-logs?from=${encodeURIComponent(from)}`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].action).toBe('user.baru');
  });

  it('menyaring berdasarkan pelaku', async () => {
    await catat();

    const kosong = await request(h.server)
      .get(`${prefix}/admin/audit-logs?actorUserId=11111111-2222-4333-8444-555555555555`)
      .set('Cookie', master.cookie)
      .expect(200);
    expect(kosong.body.data).toHaveLength(0);

    const ada = await request(h.server)
      .get(`${prefix}/admin/audit-logs?actorUserId=${master.userId}`)
      .set('Cookie', master.cookie)
      .expect(200);
    expect(ada.body.data).toHaveLength(1);
  });

  it('memberi halaman sesuai permintaan', async () => {
    for (let i = 0; i < 5; i += 1) await catat({ action: `user.aksi${i}` });

    const response = await request(h.server)
      .get(`${prefix}/admin/audit-logs?page=2&pageSize=2`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.total).toBe(5);
    expect(response.body.meta.totalPages).toBe(3);
  });

  it('menolak penyaring yang bentuknya salah', async () => {
    await request(h.server)
      .get(`${prefix}/admin/audit-logs?actorUserId=bukan-uuid`)
      .set('Cookie', master.cookie)
      .expect(422);

    await request(h.server)
      .get(`${prefix}/admin/audit-logs?from=kemarin`)
      .set('Cookie', master.cookie)
      .expect(422);
  });

  it('menyebut jenis tindakan yang benar-benar pernah tercatat', async () => {
    await catat({ action: 'user.deleted' });
    await catat({ action: 'course.published' });
    await catat({ action: 'user.deleted' });

    const response = await request(h.server)
      .get(`${prefix}/admin/audit-logs/actions`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data.actions).toEqual(['course.published', 'user.deleted']);
  });

  it('mempertahankan catatan ketika akun pelakunya dihapus', async () => {
    const korban = await h.prisma.user.create({
      data: {
        email: `pelaku-${Date.now()}@akademionline.id`,
        passwordHash: 'x',
        fullName: 'Pelaku Sementara',
      },
      select: { id: true },
    });
    await h.prisma.auditLog.create({
      data: { actorUserId: korban.id, action: 'user.updated', targetType: 'User' },
    });

    await h.prisma.user.delete({ where: { id: korban.id } });

    // ON DELETE SET NULL, bukan CASCADE: menghapus akun tidak boleh sekaligus
    // menghapus jejak apa yang pernah dilakukannya.
    const response = await request(h.server)
      .get(`${prefix}/admin/audit-logs`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].actor).toBeNull();
  });
});
