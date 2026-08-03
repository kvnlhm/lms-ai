import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

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
});
