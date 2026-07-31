import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };
const OTHER_STUDENT = { email: 'samuel@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Notifikasi dalam aplikasi', () => {
  let h: Harness;
  let courseId: string;
  const topicIds: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    courseId = (
      await h.prisma.course.findUniqueOrThrow({
        where: { slug: 'video-editing-mastery' },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    if (topicIds.length > 0) {
      await h.prisma.forumReport.deleteMany({ where: { topicId: { in: topicIds } } });
      await h.prisma.forumReply.deleteMany({ where: { topicId: { in: topicIds } } });
      await h.prisma.forumTopic.deleteMany({ where: { id: { in: topicIds } } });
    }
    await h.prisma.forumBan.deleteMany({ where: { reason: { startsWith: '[e2e]' } } });
    await h.prisma.liveSession.deleteMany({ where: { title: { startsWith: '[e2e]' } } });
    await h.close();
  });

  /** Setiap test mulai dari kotak notifikasi kosong agar tidak saling bergantung. */
  beforeEach(async () => {
    await h.prisma.notification.deleteMany({});
  });

  async function createTopic(session: { cookie: string; csrfToken: string }, title: string) {
    const response = await request(h.server)
      .post(`${prefix}/learn/courses/${courseId}/forum/topics`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ title, body: 'Isi untuk keperluan pengujian notifikasi.' })
      .expect(201);
    const id = response.body.data.id as string;
    topicIds.push(id);
    return id;
  }

  function inbox(cookie: string) {
    return request(h.server).get(`${prefix}/me/notifications`).set('Cookie', cookie).expect(200);
  }

  it('memberi tahu penulis topik ketika diskusinya dibalas', async () => {
    const author = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(author, 'Topik yang akan dibalas');

    const replier = await login(h.server, OTHER_STUDENT.email, OTHER_STUDENT.password);
    await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', replier.cookie)
      .set('X-CSRF-Token', replier.csrfToken)
      .send({ body: 'Menurutku begini.' })
      .expect(201);

    const response = await inbox(author.cookie);
    const reply = (response.body.data as Array<{ type: string; linkUrl: string | null }>).find(
      (item) => item.type === 'FORUM_REPLY',
    );
    expect(reply).toBeDefined();
    // Acceptance criteria PRD 7.14: notifikasi punya tautan ke objek terkait.
    expect(reply?.linkUrl).toBe(`/learn/${courseId}/forum/${topicId}`);
  });

  it('tidak memberi tahu ketika seseorang membalas diskusinya sendiri', async () => {
    const author = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(author, 'Topik yang dibalas sendiri');

    await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', author.cookie)
      .set('X-CSRF-Token', author.csrfToken)
      .send({ body: 'Menambahkan sendiri.' })
      .expect(201);

    const response = await inbox(author.cookie);
    const types = (response.body.data as Array<{ type: string }>).map((item) => item.type);
    expect(types).not.toContain('FORUM_REPLY');
  });

  it('memberi tahu pelajar saat haknya dicabut lalu dipulihkan', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const master = await login(h.server, MASTER.email, MASTER.password);

    const ban = await request(h.server)
      .post(`${prefix}/admin/forum/bans`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ userId: student.userId, courseId, reason: '[e2e] menguji notifikasi' })
      .expect(201);

    let types = ((await inbox(student.cookie)).body.data as Array<{ type: string }>).map(
      (item) => item.type,
    );
    expect(types).toContain('FORUM_PARTICIPATION_REVOKED');

    await request(h.server)
      .delete(`${prefix}/admin/forum/bans/${ban.body.data.id}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(200);

    types = ((await inbox(student.cookie)).body.data as Array<{ type: string }>).map(
      (item) => item.type,
    );
    expect(types).toContain('FORUM_PARTICIPATION_RESTORED');
  });

  it('mengirim pencabutan hak meski pelajar mematikan preferensinya', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const master = await login(h.server, MASTER.email, MASTER.password);
    await h.prisma.notificationPreference.upsert({
      where: { userId: student.userId },
      create: { userId: student.userId, announcementsEnabled: false },
      update: { announcementsEnabled: false },
    });

    try {
      await request(h.server)
        .post(`${prefix}/admin/forum/bans`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ userId: student.userId, courseId, reason: '[e2e] preferensi dimatikan' })
        .expect(201);

      const types = ((await inbox(student.cookie)).body.data as Array<{ type: string }>).map(
        (item) => item.type,
      );
      // Tanpa ini pelajar ditolak menulis tanpa pernah tahu sebabnya.
      expect(types).toContain('FORUM_PARTICIPATION_REVOKED');
    } finally {
      await h.prisma.notificationPreference.update({
        where: { userId: student.userId },
        data: { announcementsEnabled: true },
      });
      await h.prisma.forumBan.deleteMany({ where: { reason: { startsWith: '[e2e]' } } });
    }
  });

  it('memberi tahu Master ketika konten dilaporkan', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(student, 'Topik yang dilaporkan');

    await request(h.server)
      .post(`${prefix}/learn/forum/reports`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ topicId, reason: 'Mengandung tautan mencurigakan.' })
      .expect(201);

    const master = await login(h.server, MASTER.email, MASTER.password);
    const types = ((await inbox(master.cookie)).body.data as Array<{ type: string }>).map(
      (item) => item.type,
    );
    expect(types).toContain('FORUM_CONTENT_REPORTED');
  });

  it('memberi tahu peserta kursus ketika sesi langsung dijadwalkan', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    await request(h.server)
      .post(`${prefix}/admin/live-sessions`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({
        courseId,
        title: '[e2e] Sesi tanya jawab',
        joinUrl: 'https://zoom.us/j/1234567890',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        durationMinutes: 60,
      })
      .expect(201);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const types = ((await inbox(student.cookie)).body.data as Array<{ type: string }>).map(
      (item) => item.type,
    );
    expect(types).toContain('LIVE_SESSION_SCHEDULED');
  });

  it('menghitung yang belum dibaca dan menandainya sudah dibaca', async () => {
    const author = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(author, 'Topik untuk menguji penanda baca');
    const replier = await login(h.server, OTHER_STUDENT.email, OTHER_STUDENT.password);
    await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', replier.cookie)
      .set('X-CSRF-Token', replier.csrfToken)
      .send({ body: 'Balasan.' })
      .expect(201);

    const before = await request(h.server)
      .get(`${prefix}/me/notifications/unread-count`)
      .set('Cookie', author.cookie)
      .expect(200);
    expect(before.body.data.unread).toBeGreaterThan(0);

    await request(h.server)
      .post(`${prefix}/me/notifications/read-all`)
      .set('Cookie', author.cookie)
      .set('X-CSRF-Token', author.csrfToken)
      .expect(201);

    const after = await request(h.server)
      .get(`${prefix}/me/notifications/unread-count`)
      .set('Cookie', author.cookie)
      .expect(200);
    expect(after.body.data.unread).toBe(0);
  });

  it('tidak membocorkan notifikasi milik pengguna lain', async () => {
    const author = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(author, 'Topik milik pelajar pertama');
    const replier = await login(h.server, OTHER_STUDENT.email, OTHER_STUDENT.password);
    await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', replier.cookie)
      .set('X-CSRF-Token', replier.csrfToken)
      .send({ body: 'Balasan.' })
      .expect(201);

    const owned = await h.prisma.notification.findFirstOrThrow({
      where: { userId: author.userId },
      select: { id: true },
    });

    // Kotak masuk pelajar lain tidak memuatnya, dan menandainya dibaca ditolak.
    const intruderInbox = await inbox(replier.cookie);
    expect((intruderInbox.body.data as Array<{ id: string }>).map((n) => n.id)).not.toContain(
      owned.id,
    );

    await request(h.server)
      .patch(`${prefix}/me/notifications/${owned.id}/read`)
      .set('Cookie', replier.cookie)
      .set('X-CSRF-Token', replier.csrfToken)
      .expect(404);
  });
});
