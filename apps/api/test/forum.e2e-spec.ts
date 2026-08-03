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
      // Pemberitahuan menunjuk topiknya lewat `linkUrl`; bila dibiarkan,
      // ia menumpuk di database bersama dan mengotori pencarian test lain.
      await h.prisma.notification.deleteMany({
        where: { OR: createdTopicIds.map((id) => ({ linkUrl: { endsWith: `/forum/${id}` } })) },
      });
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

  it('memberi Master isi diskusi lengkap, termasuk balasan yang disembunyikannya', async () => {
    // Jalur pelajar menuntut enrollment dan menyaring apa pun yang
    // disembunyikan, sehingga Master tidak punya satu pun cara membaca
    // percakapan yang ia moderasi — padahal menjawab, menandai jawaban
    // terbaik, dan menghapus balasan semuanya menuntut ia melihatnya dulu.
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(student.cookie, student.csrfToken, 'Topik untuk dibaca Master');
    const balasan = await request(h.server)
      .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ body: 'Balasan yang nanti disembunyikan.' })
      .expect(201);
    const replyId = balasan.body.data.id as string;

    const master = await login(h.server, MASTER.email, MASTER.password);
    await request(h.server)
      .patch(`${prefix}/admin/forum/replies/${replyId}/hidden`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ isHidden: true, reason: 'Menyebut nomor pribadi.' })
      .expect(200);

    // Dari mata pelajar balasannya lenyap; itulah gunanya disembunyikan.
    const dariPelajar = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(dariPelajar.body.data.replies).toHaveLength(0);

    const dariMaster = await request(h.server)
      .get(`${prefix}/admin/forum/topics/${topicId}`)
      .set('Cookie', master.cookie)
      .expect(200);
    expect(dariMaster.body.data.body).toBe('Isi pertanyaan untuk keperluan pengujian.');
    expect(dariMaster.body.data.course.title).toBeTruthy();
    // Surel penulis: satu-satunya pembeda dua pelajar bernama sama sebelum
    // haknya dicabut.
    expect(dariMaster.body.data.author.email).toBe(STUDENT.email);
    expect(dariMaster.body.data.replies).toHaveLength(1);
    expect(dariMaster.body.data.replies[0]).toMatchObject({
      id: replyId,
      isHidden: true,
      moderationReason: 'Menyebut nomor pribadi.',
    });

    // Tanpa alasan yang ikut terkirim, menampilkannya kembali menjadi
    // keputusan buta.
    await request(h.server)
      .patch(`${prefix}/admin/forum/replies/${replyId}/hidden`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ isHidden: false })
      .expect(200);
    const kembali = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(kembali.body.data.replies).toHaveLength(1);
  });

  it('memberi tahu penulis diskusi ketika Master yang menjawabnya', async () => {
    // Jalur pelajar memberitahu penulis topik, jalur Master tidak. Justru
    // jawaban Master yang paling ditunggu, dan tanpa pemberitahuan pelajar
    // hanya menemukannya bila kebetulan membuka kembali diskusinya sendiri.
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(student.cookie, student.csrfToken, 'Topik yang dijawab Master');

    const master = await login(h.server, MASTER.email, MASTER.password);
    await request(h.server)
      .post(`${prefix}/admin/forum/topics/${topicId}/replies`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ body: 'Jawaban resmi dari Master.' })
      .expect(201);

    // Dicari lewat `linkUrl`, bukan judul topiknya: database test dipakai
    // bersama dan tidak pernah dikosongkan, sehingga pencarian berdasarkan
    // judul dapat menemukan pemberitahuan dari jalannya test sebelumnya.
    const pemberitahuan = await h.prisma.notification.findFirst({
      where: {
        userId: student.userId,
        type: 'FORUM_REPLY',
        linkUrl: `/learn/${courseId}/forum/${topicId}`,
      },
      select: { title: true, body: true },
    });
    expect(pemberitahuan).toMatchObject({
      title: 'Master menjawab diskusimu',
      body: 'Topik yang dijawab Master',
    });

    // Jawaban Master tetap terbaca pelajar seperti balasan biasa.
    const dariPelajar = await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(dariPelajar.body.data.replies).toHaveLength(1);
    expect(dariPelajar.body.data.replyCount).toBe(1);
  });

  it('melepas penanda jawaban terbaik ketika balasannya lenyap', async () => {
    // `bestReplyId` tetap menunjuk balasan yang dihapus atau disembunyikan,
    // sebab keduanya hanya menandai barisnya. Akibatnya topiknya berstatus
    // selesai sementara jawabannya tidak pernah dikirim lagi ke pelajar.
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const master = await login(h.server, MASTER.email, MASTER.password);

    async function topikDenganJawabanTerbaik(judul: string): Promise<[string, string]> {
      const topicId = await createTopic(student.cookie, student.csrfToken, judul);
      const balasan = await request(h.server)
        .post(`${prefix}/learn/forum/topics/${topicId}/replies`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Balasan yang akan ditandai terbaik.' })
        .expect(201);
      const replyId = balasan.body.data.id as string;
      const ditandai = await request(h.server)
        .patch(`${prefix}/admin/forum/topics/${topicId}/best-reply`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ replyId })
        .expect(200);
      // Menandai jawaban terbaik berarti pertanyaannya sudah terjawab.
      expect(ditandai.body.data).toMatchObject({ bestReplyId: replyId, status: 'RESOLVED' });
      return [topicId, replyId];
    }

    const [topikDihapus, balasanDihapus] = await topikDenganJawabanTerbaik('Jawaban yang dihapus');
    await request(h.server)
      .delete(`${prefix}/admin/forum/replies/${balasanDihapus}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(204);
    const setelahDihapus = await request(h.server)
      .get(`${prefix}/admin/forum/topics/${topikDihapus}`)
      .set('Cookie', master.cookie)
      .expect(200);
    expect(setelahDihapus.body.data.bestReplyId).toBeNull();
    expect(setelahDihapus.body.data.status).toBe('OPEN');

    const [topikDisembunyikan, balasanDisembunyikan] =
      await topikDenganJawabanTerbaik('Jawaban yang disembunyikan');
    await request(h.server)
      .patch(`${prefix}/admin/forum/replies/${balasanDisembunyikan}/hidden`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ isHidden: true, reason: 'Ternyata keliru.' })
      .expect(200);
    const setelahDisembunyikan = await request(h.server)
      .get(`${prefix}/admin/forum/topics/${topikDisembunyikan}`)
      .set('Cookie', master.cookie)
      .expect(200);
    expect(setelahDisembunyikan.body.data.bestReplyId).toBeNull();
    expect(setelahDisembunyikan.body.data.status).toBe('OPEN');

    // Pembatalan yang disengaja pun mengembalikan statusnya. Tanpa itu topik
    // tetap tercatat selesai padahal tidak ada satu jawaban pun yang ditunjuk.
    const [topikDibatalkan] = await topikDenganJawabanTerbaik('Jawaban yang dibatalkan');
    const dibatalkan = await request(h.server)
      .patch(`${prefix}/admin/forum/topics/${topikDibatalkan}/best-reply`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({})
      .expect(200);
    expect(dibatalkan.body.data).toMatchObject({ bestReplyId: null, status: 'OPEN' });
  });

  it('menghapus diskusi beserta jejaknya dari mata pelajar', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const topicId = await createTopic(student.cookie, student.csrfToken, 'Topik yang dihapus Master');

    const master = await login(h.server, MASTER.email, MASTER.password);
    await request(h.server)
      .delete(`${prefix}/admin/forum/topics/${topicId}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(204);

    await request(h.server)
      .get(`${prefix}/learn/forum/topics/${topicId}`)
      .set('Cookie', student.cookie)
      .expect(404);
    // Halaman moderasinya pun tidak lagi dapat dibuka, jadi tombol-tombolnya
    // tidak menawarkan tindakan atas sesuatu yang sudah tidak ada.
    await request(h.server)
      .get(`${prefix}/admin/forum/topics/${topicId}`)
      .set('Cookie', master.cookie)
      .expect(404);
  });

  it('menolak pelajar mengakses endpoint moderasi', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);

    const topicId = await createTopic(student.cookie, student.csrfToken, 'Topik milik pelajar');

    await request(h.server)
      .get(`${prefix}/admin/forum/topics`)
      .set('Cookie', student.cookie)
      .expect(403);

    // Membaca satu utas lewat jalur moderasi menembus penyaringan konten
    // tersembunyi, jadi pintunya harus tertutup sama rapatnya — termasuk bagi
    // pemilik topiknya sendiri.
    await request(h.server)
      .get(`${prefix}/admin/forum/topics/${topicId}`)
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
