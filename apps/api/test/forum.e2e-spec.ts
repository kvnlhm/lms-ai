import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };
const OTHER_STUDENT = { email: 'samuel@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Forum diskusi', () => {
  let h: Harness;
  let courseId: string;
  let draftCourseId: string;
  const createdTopicIds: string[] = [];

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
    // Test ini menulis ke database bersama, jadi jejaknya dibersihkan sendiri.
    if (createdTopicIds.length > 0) {
      await h.prisma.forumReport.deleteMany({ where: { topicId: { in: createdTopicIds } } });
      await h.prisma.forumReply.deleteMany({ where: { topicId: { in: createdTopicIds } } });
      await h.prisma.forumTopic.deleteMany({ where: { id: { in: createdTopicIds } } });
    }
    await h.prisma.forumBan.deleteMany({ where: { reason: { startsWith: '[e2e]' } } });
    await h.close();
  });

  async function createTopic(cookie: string, csrfToken: string, title: string): Promise<string> {
    const response = await request(h.server)
      .post(`${prefix}/learn/courses/${courseId}/forum/topics`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title, body: 'Isi pertanyaan untuk keperluan pengujian.' })
      .expect(201);
    const id = response.body.data.id as string;
    createdTopicIds.push(id);
    return id;
  }

  it('menyebutkan reaksi milik pengguna sendiri, bukan hanya jumlahnya', async () => {
    // Reaksi adalah saklar. Tanpa penanda ini antarmuka hanya punya angka,
    // sehingga setelah halaman dimuat ulang pengguna tidak tahu apakah dirinya
    // termasuk di antara yang menyukainya.
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(session.cookie, session.csrfToken, 'Topik untuk reaksi');

    const balasan = await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ body: 'Balasan yang akan disukai pada pengujian ini.' })
      .expect(201);
    const replyId = balasan.body.data.id as string;

    const awal = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(awal.body.data.reactedByMe).toBe(false);
    expect(awal.body.data.replies[0].reactedByMe).toBe(false);

    for (const path of [
      `/learn/forum/topics/${topicId}/reactions`,
      `/learn/forum/replies/${replyId}/reactions`,
    ]) {
      await request(h.server)
        .post(`${prefix}${path}`)
        .set('Cookie', session.cookie)
        .set('X-CSRF-Token', session.csrfToken)
        .expect(200);
    }

    const sesudah = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(sesudah.body.data.reactedByMe).toBe(true);
    expect(sesudah.body.data.replies[0].reactedByMe).toBe(true);

    // Pengguna lain menyukainya tidak membuat penanda milik kita ikut menyala.
    const lain = await login(h.server, OTHER_STUDENT.email, OTHER_STUDENT.password);
    const dariMataOrangLain = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', lain.cookie)
      .expect(200);
    expect(dariMataOrangLain.body.data.reactedByMe).toBe(false);
    expect(dariMataOrangLain.body.data.replies[0].reactedByMe).toBe(false);
    expect(dariMataOrangLain.body.data._count.reactions).toBe(1);

    // Menekannya lagi mematikan reaksinya, dan penandanya ikut padam.
    await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/reactions`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .expect(200);
    const setelahDimatikan = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(setelahDimatikan.body.data.reactedByMe).toBe(false);
  });

  it('hanya penulis topik yang boleh mengelolanya, dan tidak lagi setelah dikunci', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(session.cookie, session.csrfToken, 'Topik untuk dikelola');

    const milikSendiri = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(milikSendiri.body.data.canManage).toBe(true);

    const lain = await login(h.server, OTHER_STUDENT.email, OTHER_STUDENT.password);
    const milikOrangLain = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', lain.cookie)
      .expect(200);
    expect(milikOrangLain.body.data.canManage).toBe(false);

    // `canManage` harus sepakat dengan yang benar-benar ditegakkan server:
    // topik terkunci ditolak `updateTopic` maupun `deleteTopic`.
    const master = await login(h.server, MASTER.email, MASTER.password);
    await request(h.server)
      .patch(`${prefix}/admin/forum/topics/${topicId}/status`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ status: 'LOCKED' })
      .expect(200);

    const setelahDikunci = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(setelahDikunci.body.data.canManage).toBe(false);

    await request(h.server)
      .patch(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ title: 'Judul baru yang seharusnya ditolak' })
      .expect(409);
  });

  it('pelajar peserta kursus dapat membuat dan membaca topik', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(session.cookie, session.csrfToken, 'Cara memulai editing');

    const list = await request(h.server)
      .get(`${prefix}/learn/courses/${courseId}/forum/topics`)
      .set('Cookie', session.cookie)
      .expect(200);

    expect((list.body.data as Array<{ id: string }>).map((t) => t.id)).toContain(topicId);
  });

  it('menolak akses forum kursus yang tidak dimiliki pelajar', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);

    // 404, bukan 403: keberadaan forum kursus lain tidak boleh disimpulkan.
    await request(h.server)
      .get(`${prefix}/learn/courses/${draftCourseId}/forum/topics`)
      .set('Cookie', session.cookie)
      .expect(404);
  });

  it('menolak pelajar mengubah topik milik pelajar lain', async () => {
    const owner = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(owner.cookie, owner.csrfToken, 'Topik milik Freddie');

    const intruder = await login(h.server, OTHER_STUDENT.email, OTHER_STUDENT.password);
    await request(h.server)
      .patch(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', intruder.cookie)
      .set('X-CSRF-Token', intruder.csrfToken)
      .send({ body: 'Disunting orang lain.' })
      .expect(403);
  });

  it('menyembunyikan topik dari pelajar setelah Master menyembunyikannya', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(student.cookie, student.csrfToken, 'Topik yang akan ditutup');

    const master = await login(h.server, MASTER.email, MASTER.password);
    await request(h.server)
      .patch(`${prefix}/admin/forum/topics/${topicId}/status`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ status: 'HIDDEN', reason: 'Tidak relevan.' })
      .expect(200);

    await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', student.cookie)
      .expect(404);

    const list = await request(h.server)
      .get(`${prefix}/learn/courses/${courseId}/forum/topics`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect((list.body.data as Array<{ id: string }>).map((t) => t.id)).not.toContain(topicId);
  });

  it('menolak balasan pada topik yang dikunci', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(student.cookie, student.csrfToken, 'Topik yang dikunci');

    const master = await login(h.server, MASTER.email, MASTER.password);
    await request(h.server)
      .patch(`${prefix}/admin/forum/topics/${topicId}/status`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ status: 'LOCKED' })
      .expect(200);

    const blocked = await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ body: 'Masih ingin menambahkan.' })
      .expect(409);
    expect(blocked.body.error.code).toBe('DISCUSSION_LOCKED');
  });

  it('mencabut lalu mengembalikan hak berdiskusi seorang pelajar', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(student.cookie, student.csrfToken, 'Topik sebelum dicabut');

    const master = await login(h.server, MASTER.email, MASTER.password);
    const ban = await request(h.server)
      .post(`${prefix}/admin/forum/bans`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ userId: student.userId, courseId, reason: '[e2e] berkomentar kasar' })
      .expect(201);

    await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ body: 'Membalas saat dicabut.' })
      .expect(403);

    // Hak baca tidak ikut dicabut: pelajar tetap dapat mengikuti materi.
    await request(h.server)
      .get(`${prefix}/learn/courses/${courseId}/forum/topics`)
      .set('Cookie', student.cookie)
      .expect(200);

    await request(h.server)
      .delete(`${prefix}/admin/forum/bans/${ban.body.data.id}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(200);

    await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ body: 'Membalas setelah dipulihkan.' })
      .expect(201);
  });

  it('meneruskan laporan pelajar ke daftar review Master', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(student.cookie, student.csrfToken, 'Topik yang dilaporkan');

    await request(h.server)
      .post(`${prefix}/learn/forum/reports`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ topicId, reason: 'Mengandung tautan penipuan.' })
      .expect(201);

    const master = await login(h.server, MASTER.email, MASTER.password);
    const reports = await request(h.server)
      .get(`${prefix}/admin/forum/reports?status=PENDING`)
      .set('Cookie', master.cookie)
      .expect(200);

    const reported = (reports.body.data as Array<{ topic: { id: string } | null }>).some(
      (report) => report.topic?.id === topicId,
    );
    expect(reported).toBe(true);
  });

  it('menolak pelajar mengakses endpoint moderasi', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);

    await request(h.server)
      .get(`${prefix}/admin/forum/topics`)
      .set('Cookie', student.cookie)
      .expect(403);

    await request(h.server)
      .post(`${prefix}/admin/forum/bans`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ userId: student.userId, reason: '[e2e] percobaan tidak sah' })
      .expect(403);
  });
});
