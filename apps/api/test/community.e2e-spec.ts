import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };
const STUDENT_LAIN = { email: 'samuel@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Community channels', () => {
  let h: Harness | undefined;
  const channelIds: string[] = [];

  beforeAll(async () => { h = await startHarness(); });

  afterAll(async () => {
    if (!h) return;
    if (channelIds.length > 0) await h.prisma.communityChannel.deleteMany({ where: { id: { in: channelIds } } });
    await h.close();
  });

  it('mewajibkan login untuk membaca channel', async () => {
    if (!h) throw new Error('Harness belum siap.');
    await request(h.server).get(`${prefix}/community/channels`).expect(401);
  });

  it('menolak Pelajar membuat channel dan mengizinkan Master', async () => {
    if (!h) throw new Error('Harness belum siap.');
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await request(h.server)
      .post(`${prefix}/admin/community/channels`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ name: 'Channel terlarang' })
      .expect(403);

    const master = await login(h.server, MASTER.email, MASTER.password);
    const response = await request(h.server)
      .post(`${prefix}/admin/community/channels`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ name: `Pengumuman E2E ${Date.now()}`, isReadOnly: true })
      .expect(201);
    channelIds.push(response.body.data.id as string);
  });

  it('channel baca-saja hanya dapat ditulis Master', async () => {
    if (!h) throw new Error('Harness belum siap.');
    const channelId = channelIds[0];
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await request(h.server)
      .post(`${prefix}/community/channels/${channelId}/posts`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ body: 'Pelajar tidak boleh menulis di sini.' })
      .expect(403);

    const master = await login(h.server, MASTER.email, MASTER.password);
    const post = await request(h.server)
      .post(`${prefix}/community/channels/${channelId}/posts`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ body: 'Pengumuman resmi dari Master.' })
      .expect(201);
    expect(post.body.data.channel.id).toBe(channelId);
  });

  it('Pelajar dapat menulis, membalas, dan bereaksi di channel komunitas', async () => {
    if (!h) throw new Error('Harness belum siap.');
    const master = await login(h.server, MASTER.email, MASTER.password);
    const channel = await request(h.server)
      .post(`${prefix}/admin/community/channels`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ name: `Diskusi E2E ${Date.now()}` })
      .expect(201);
    const channelId = channel.body.data.id as string;
    channelIds.push(channelId);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const post = await request(h.server)
      .post(`${prefix}/community/channels/${channelId}/posts`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ body: 'Halo komunitas.' })
      .expect(201);
    const postId = post.body.data.id as string;

    await request(h.server)
      .post(`${prefix}/community/posts/${postId}/comments`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ body: 'Balasan pertama.' })
      .expect(201);

    const reaction = await request(h.server)
      .post(`${prefix}/community/posts/${postId}/reaction`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .expect(200);
    expect(reaction.body.data).toMatchObject({ reacted: true, reactionCount: 1 });
  });

  describe('menjangkau isi di luar jendela pertama', () => {
    it('pesan lama tetap dapat diambil, dan urutannya kronologis bukan menurut aktivitas', async () => {
      if (!h) throw new Error('Harness belum siap.');
      const master = await login(h.server, MASTER.email, MASTER.password);
      const channel = await request(h.server)
        .post(`${prefix}/admin/community/channels`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ name: `Arsip E2E ${Date.now()}` })
        .expect(201);
      const channelId = channel.body.data.id as string;
      const slug = channel.body.data.slug as string;
      channelIds.push(channelId);

      const student = await login(h.server, STUDENT.email, STUDENT.password);
      const dibuat: string[] = [];
      for (let nomor = 1; nomor <= 5; nomor += 1) {
        const post = await request(h.server)
          .post(`${prefix}/community/channels/${channelId}/posts`)
          .set('Cookie', student.cookie)
          .set('X-CSRF-Token', student.csrfToken)
          .send({ body: `Pesan ${nomor}.` })
          .expect(201);
        dibuat.push(post.body.data.id as string);
      }

      // Membalas pesan tertua menaikkan `lastActivityAt`-nya. Percakapan tidak
      // boleh tersusun ulang karenanya — pembaca akan kehilangan alurnya.
      await request(h.server)
        .post(`${prefix}/community/posts/${dibuat[0]}/comments`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Balasan pada pesan tertua.' })
        .expect(201);

      const halamanSatu = await request(h.server)
        .get(`${prefix}/community/channels/${slug}/posts?page=1&pageSize=2`)
        .set('Cookie', student.cookie)
        .expect(200);
      expect(halamanSatu.body.meta.total).toBe(5);
      expect(halamanSatu.body.data.map((item: { body: string }) => item.body)).toEqual(['Pesan 5.', 'Pesan 4.']);

      const halamanTiga = await request(h.server)
        .get(`${prefix}/community/channels/${slug}/posts?page=3&pageSize=2`)
        .set('Cookie', student.cookie)
        .expect(200);
      expect(halamanTiga.body.data.map((item: { body: string }) => item.body)).toEqual(['Pesan 1.']);
    });

    it('balasan ketujuh dan seterusnya tetap terjangkau, dan pratinjaunya membawa yang terbaru', async () => {
      if (!h) throw new Error('Harness belum siap.');
      const master = await login(h.server, MASTER.email, MASTER.password);
      const channel = await request(h.server)
        .post(`${prefix}/admin/community/channels`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ name: `Balasan E2E ${Date.now()}` })
        .expect(201);
      channelIds.push(channel.body.data.id as string);

      const student = await login(h.server, STUDENT.email, STUDENT.password);
      const post = await request(h.server)
        .post(`${prefix}/community/channels/${channel.body.data.id}/posts`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Tulisan dengan banyak balasan.' })
        .expect(201);
      const postId = post.body.data.id as string;

      for (let nomor = 1; nomor <= 8; nomor += 1) {
        await request(h.server)
          .post(`${prefix}/community/posts/${postId}/comments`)
          .set('Cookie', student.cookie)
          .set('X-CSRF-Token', student.csrfToken)
          .send({ body: `Balasan ${nomor}.` })
          .expect(201);
      }

      // Pratinjau membawa enam terakhir, bukan enam pertama: pada tulisan yang
      // ramai, percakapan terbarulah yang paling perlu terlihat.
      const feed = await request(h.server)
        .get(`${prefix}/community/channels/${channel.body.data.slug}/posts`)
        .set('Cookie', student.cookie)
        .expect(200);
      const pratinjau = feed.body.data.find((item: { id: string }) => item.id === postId);
      expect(pratinjau.commentCount).toBe(8);
      expect(pratinjau.comments.map((item: { body: string }) => item.body))
        .toEqual(['Balasan 3.', 'Balasan 4.', 'Balasan 5.', 'Balasan 6.', 'Balasan 7.', 'Balasan 8.']);

      // Dan dua yang tertimbun itu tetap dapat dibaca.
      const semua = await request(h.server)
        .get(`${prefix}/community/posts/${postId}/comments?page=1&pageSize=3`)
        .set('Cookie', student.cookie)
        .expect(200);
      expect(semua.body.meta.total).toBe(8);
      expect(semua.body.data.map((item: { body: string }) => item.body))
        .toEqual(['Balasan 1.', 'Balasan 2.', 'Balasan 3.']);
    });
  });

  describe('menyematkan', () => {
    it('hanya Master yang dapat menyematkan, dan sematannya menaikkan tulisan pada feed', async () => {
      if (!h) throw new Error('Harness belum siap.');
      const master = await login(h.server, MASTER.email, MASTER.password);
      const channel = await request(h.server)
        .post(`${prefix}/admin/community/channels`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ name: `Sematan E2E ${Date.now()}` })
        .expect(201);
      const channelId = channel.body.data.id as string;
      const slug = channel.body.data.slug as string;
      channelIds.push(channelId);

      const student = await login(h.server, STUDENT.email, STUDENT.password);
      const lama = await request(h.server)
        .post(`${prefix}/community/channels/${channelId}/posts`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Tulisan lama yang layak disematkan.' })
        .expect(201);
      const lamaId = lama.body.data.id as string;
      expect(lama.body.data.isPinned).toBe(false);
      // Penulisnya sendiri pun tidak berhak menyematkan tulisannya.
      expect(lama.body.data.canPin).toBe(false);

      await request(h.server)
        .post(`${prefix}/community/channels/${channelId}/posts`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Tulisan yang lebih baru.' })
        .expect(201);

      await request(h.server)
        .patch(`${prefix}/community/posts/${lamaId}/pin`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ isPinned: true })
        .expect(403);

      const disematkan = await request(h.server)
        .patch(`${prefix}/community/posts/${lamaId}/pin`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ isPinned: true })
        .expect(200);
      expect(disematkan.body.data.isPinned).toBe(true);
      expect(disematkan.body.data.canPin).toBe(true);

      // Feed mengurutkan tersemat lebih dulu, sehingga tulisan yang lebih tua
      // kini berada di atas yang lebih baru.
      const feed = await request(h.server)
        .get(`${prefix}/community/feed?page=1&pageSize=5`)
        .set('Cookie', student.cookie)
        .expect(200);
      expect(feed.body.data[0].id).toBe(lamaId);

      // Percakapan channel tetap kronologis; sematannya hidup di daftar
      // tersendiri supaya tidak ikut tergulung hilang.
      const percakapan = await request(h.server)
        .get(`${prefix}/community/channels/${slug}/posts`)
        .set('Cookie', student.cookie)
        .expect(200);
      expect(percakapan.body.data[0].body).toBe('Tulisan yang lebih baru.');

      const tersemat = await request(h.server)
        .get(`${prefix}/community/channels/${slug}/pinned`)
        .set('Cookie', student.cookie)
        .expect(200);
      expect(tersemat.body.data.map((item: { id: string }) => item.id)).toEqual([lamaId]);

      // Menyematkan ucapan orang lain adalah keputusan editorial atas apa yang
      // dilihat semua orang, jadi jejaknya dicatat.
      const jejak = await h.prisma.auditLog.findFirst({
        where: { action: 'community.post.pin', targetId: lamaId },
        select: { id: true },
      });
      expect(jejak).not.toBeNull();

      await request(h.server)
        .patch(`${prefix}/community/posts/${lamaId}/pin`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ isPinned: false })
        .expect(200);
      const sesudah = await request(h.server)
        .get(`${prefix}/community/channels/${slug}/pinned`)
        .set('Cookie', student.cookie)
        .expect(200);
      expect(sesudah.body.data).toEqual([]);
    });
  });

  describe('menyunting dan menghapus', () => {
    /** Channel bebas tulis beserta satu tulisan pelajar di dalamnya. */
    async function tulisanPelajar(h: Harness) {
      const master = await login(h.server, MASTER.email, MASTER.password);
      const channel = await request(h.server)
        .post(`${prefix}/admin/community/channels`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ name: `Moderasi E2E ${Date.now()}` })
        .expect(201);
      const channelId = channel.body.data.id as string;
      channelIds.push(channelId);

      const student = await login(h.server, STUDENT.email, STUDENT.password);
      const post = await request(h.server)
        .post(`${prefix}/community/channels/${channelId}/posts`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Tulisan asli pelajar.' })
        .expect(201);
      return { master, student, channelId, post: post.body.data };
    }

    it('penulis dapat mengubah tulisannya, dan perubahannya meninggalkan jejak', async () => {
      if (!h) throw new Error('Harness belum siap.');
      const { student, post } = await tulisanPelajar(h);
      expect(post.editedAt).toBeNull();
      expect(post).toMatchObject({ canEdit: true, canDelete: true });

      const diubah = await request(h.server)
        .patch(`${prefix}/community/posts/${post.id}`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Tulisan yang sudah diperbaiki.' })
        .expect(200);
      expect(diubah.body.data.body).toBe('Tulisan yang sudah diperbaiki.');
      expect(diubah.body.data.editedAt).not.toBeNull();
    });

    it('Master dapat menghapus tulisan pelajar, tetapi tidak dapat mengubah isinya', async () => {
      if (!h) throw new Error('Harness belum siap.');
      const { master, post } = await tulisanPelajar(h);

      // Kuasa moderasi adalah menghapus yang tidak pantas, bukan menaruh
      // kata-kata baru ke dalam mulut orang lain.
      await request(h.server)
        .patch(`${prefix}/community/posts/${post.id}`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .send({ body: 'Master menulis ulang ucapan pelajar.' })
        .expect(403);

      const terlihatMaster = await request(h.server)
        .get(`${prefix}/community/feed`)
        .set('Cookie', master.cookie)
        .expect(200);
      const dilihatMaster = terlihatMaster.body.data.find((item: { id: string }) => item.id === post.id);
      expect(dilihatMaster).toMatchObject({ canEdit: false, canDelete: true });

      await request(h.server)
        .delete(`${prefix}/community/posts/${post.id}`)
        .set('Cookie', master.cookie)
        .set('X-CSRF-Token', master.csrfToken)
        .expect(204);

      const tinggal = await h.prisma.communityPost.findUnique({ where: { id: post.id }, select: { deletedAt: true } });
      expect(tinggal?.deletedAt).not.toBeNull();

      // Menghapus ucapan orang lain harus dapat ditagih kemudian.
      const jejak = await h.prisma.auditLog.findFirst({
        where: { action: 'community.post.delete', targetId: post.id },
        select: { actorUserId: true, beforeData: true },
      });
      expect(jejak).not.toBeNull();
      expect(JSON.stringify(jejak?.beforeData)).toContain('Tulisan asli pelajar.');
    });

    it('pelajar lain tidak dapat mengubah maupun menghapus tulisan orang', async () => {
      if (!h) throw new Error('Harness belum siap.');
      const { post } = await tulisanPelajar(h);
      const orangLain = await login(h.server, STUDENT_LAIN.email, STUDENT_LAIN.password);

      const terlihat = await request(h.server)
        .get(`${prefix}/community/feed`)
        .set('Cookie', orangLain.cookie)
        .expect(200);
      const dilihatOrangLain = terlihat.body.data.find((item: { id: string }) => item.id === post.id);
      expect(dilihatOrangLain).toMatchObject({ canEdit: false, canDelete: false });

      await request(h.server)
        .patch(`${prefix}/community/posts/${post.id}`)
        .set('Cookie', orangLain.cookie)
        .set('X-CSRF-Token', orangLain.csrfToken)
        .send({ body: 'Bukan tulisanku.' })
        .expect(403);

      await request(h.server)
        .delete(`${prefix}/community/posts/${post.id}`)
        .set('Cookie', orangLain.cookie)
        .set('X-CSRF-Token', orangLain.csrfToken)
        .expect(403);
    });

    it('menghapus balasan mengoreksi jumlah balasan pada tulisannya', async () => {
      if (!h) throw new Error('Harness belum siap.');
      const { student, post } = await tulisanPelajar(h);

      const pertama = await request(h.server)
        .post(`${prefix}/community/posts/${post.id}/comments`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Balasan pertama.' })
        .expect(201);
      await request(h.server)
        .post(`${prefix}/community/posts/${post.id}/comments`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .send({ body: 'Balasan kedua.' })
        .expect(201);

      await request(h.server)
        .delete(`${prefix}/community/comments/${pertama.body.data.id}`)
        .set('Cookie', student.cookie)
        .set('X-CSRF-Token', student.csrfToken)
        .expect(204);

      const sesudah = await h.prisma.communityPost.findUnique({
        where: { id: post.id }, select: { commentCount: true },
      });
      expect(sesudah?.commentCount).toBe(1);
    });
  });
});
