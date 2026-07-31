import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Pengumuman', () => {
  let h: Harness;
  let courseId: string;
  let draftCourseId: string;

  beforeAll(async () => {
    h = await startHarness();
    courseId = (
      await h.prisma.course.findUniqueOrThrow({
        where: { slug: 'video-editing-mastery' },
        select: { id: true },
      })
    ).id;
    draftCourseId = (
      await h.prisma.course.findUniqueOrThrow({
        where: { slug: 'generative-ai-mastery' },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    await h.prisma.announcement.deleteMany({});
    await h.prisma.notification.deleteMany({});
  });

  async function create(
    master: { cookie: string; csrfToken: string },
    body: Record<string, unknown>,
  ): Promise<string> {
    const response = await request(h.server)
      .post(`${prefix}/admin/announcements`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ title: 'Pengumuman uji', body: 'Isi pengumuman.', ...body })
      .expect(201);
    return response.body.data.id as string;
  }

  function publish(master: { cookie: string; csrfToken: string }, id: string) {
    return request(h.server)
      .post(`${prefix}/admin/announcements/${id}/publish`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken);
  }

  function inbox(cookie: string) {
    return request(h.server).get(`${prefix}/me/announcements`).set('Cookie', cookie).expect(200);
  }

  it('menyembunyikan draft dari pelajar dan menampilkannya setelah terbit', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const id = await create(master, { audience: 'ALL_USERS' });

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    let ids = ((await inbox(student.cookie)).body.data as Array<{ id: string }>).map((a) => a.id);
    expect(ids).not.toContain(id);

    await publish(master, id).expect(200);

    ids = ((await inbox(student.cookie)).body.data as Array<{ id: string }>).map((a) => a.id);
    expect(ids).toContain(id);
  });

  it('menghormati jadwal: yang diterbitkan untuk masa depan belum tampil', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const id = await create(master, {
      audience: 'ALL_USERS',
      publishedAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await publish(master, id).expect(200);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const ids = ((await inbox(student.cookie)).body.data as Array<{ id: string }>).map((a) => a.id);
    expect(ids).not.toContain(id);
  });

  it('berhenti menampilkan pengumuman yang sudah berakhir', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const id = await create(master, {
      audience: 'ALL_USERS',
      publishedAt: new Date(Date.now() - 7_200_000).toISOString(),
      endsAt: new Date(Date.now() - 3_600_000).toISOString(),
    });
    await publish(master, id).expect(200);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const ids = ((await inbox(student.cookie)).body.data as Array<{ id: string }>).map((a) => a.id);
    expect(ids).not.toContain(id);
  });

  it('mengirim pengumuman kursus hanya kepada pesertanya', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const mine = await create(master, { audience: 'COURSE_LEARNERS', courseId });
    // Pelajar tidak terdaftar pada kursus draf ini.
    const notMine = await create(master, { audience: 'COURSE_LEARNERS', courseId: draftCourseId });
    await publish(master, mine).expect(200);
    await publish(master, notMine).expect(200);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const ids = ((await inbox(student.cookie)).body.data as Array<{ id: string }>).map((a) => a.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(notMine);
  });

  it('mengirim pengumuman bertarget hanya kepada penerima yang dipilih', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const other = await h.prisma.user.findUniqueOrThrow({
      where: { email: 'samuel@akademionline.id' },
      select: { id: true },
    });

    const forOther = await create(master, { audience: 'SPECIFIC_USERS', userIds: [other.id] });
    await publish(master, forOther).expect(200);

    const ids = ((await inbox(student.cookie)).body.data as Array<{ id: string }>).map((a) => a.id);
    expect(ids).not.toContain(forOther);
  });

  it('memberi notifikasi ketika pengumuman terbit', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const id = await create(master, { audience: 'ALL_USERS', title: 'Libur akhir pekan' });
    await publish(master, id).expect(200);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const notifications = await request(h.server)
      .get(`${prefix}/me/notifications`)
      .set('Cookie', student.cookie)
      .expect(200);
    const types = (notifications.body.data as Array<{ type: string }>).map((n) => n.type);
    expect(types).toContain('ANNOUNCEMENT_PUBLISHED');
  });

  it('mencatat status sudah dibaca', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const id = await create(master, { audience: 'ALL_USERS' });
    await publish(master, id).expect(200);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const before = await request(h.server)
      .get(`${prefix}/me/announcements/unread-count`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(before.body.data.unread).toBeGreaterThan(0);

    await request(h.server)
      .post(`${prefix}/me/announcements/${id}/read`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .expect(200);

    const after = await request(h.server)
      .get(`${prefix}/me/announcements/unread-count`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(after.body.data.unread).toBe(0);
  });

  it('menolak menandai pengumuman yang bukan untuknya', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const other = await h.prisma.user.findUniqueOrThrow({
      where: { email: 'samuel@akademionline.id' },
      select: { id: true },
    });
    const forOther = await create(master, { audience: 'SPECIFIC_USERS', userIds: [other.id] });
    await publish(master, forOther).expect(200);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    // 404, bukan 403: keberadaannya pun tidak boleh dapat disimpulkan.
    await request(h.server)
      .post(`${prefix}/me/announcements/${forOther}/read`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .expect(404);
  });

  it('menolak pelajar mengelola pengumuman', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);

    await request(h.server)
      .get(`${prefix}/admin/announcements`)
      .set('Cookie', student.cookie)
      .expect(403);

    await request(h.server)
      .post(`${prefix}/admin/announcements`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ title: 'Percobaan', body: 'Tidak sah.', audience: 'ALL_USERS' })
      .expect(403);
  });

  it('menolak audiens kursus tanpa kursus dan audiens bertarget tanpa penerima', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);

    await request(h.server)
      .post(`${prefix}/admin/announcements`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ title: 'Tanpa kursus', body: 'Isi.', audience: 'COURSE_LEARNERS' })
      .expect(422);

    await request(h.server)
      .post(`${prefix}/admin/announcements`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ title: 'Tanpa penerima', body: 'Isi.', audience: 'SPECIFIC_USERS', userIds: [] })
      .expect(422);
  });
});
