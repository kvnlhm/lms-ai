import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

const HOUR = 3_600_000;

describe('Sesi belajar langsung', () => {
  let h: Harness;
  let courseId: string;
  let draftCourseId: string;
  const created: string[] = [];

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
    if (created.length > 0) {
      await h.prisma.liveSession.deleteMany({ where: { id: { in: created } } });
    }
    await h.close();
  });

  async function schedule(
    cookie: string,
    csrfToken: string,
    startsAt: Date,
    durationMinutes = 60,
  ): Promise<string> {
    const response = await request(h.server)
      .post(`${prefix}/admin/live-sessions`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        courseId,
        title: 'Kelas langsung pengujian',
        joinUrl: 'https://zoom.us/j/1234567890',
        startsAt: startsAt.toISOString(),
        durationMinutes,
      })
      .expect(201);
    const id = response.body.data.id as string;
    created.push(id);
    return id;
  }

  it('menampilkan sesi mendatang kepada peserta kursus', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const id = await schedule(master.cookie, master.csrfToken, new Date(Date.now() + 24 * HOUR));

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const response = await request(h.server)
      .get(`${prefix}/learn/courses/${courseId}/live-sessions`)
      .set('Cookie', student.cookie)
      .expect(200);

    const session = (response.body.data as Array<Record<string, unknown>>).find(
      (item) => item.id === id,
    );
    expect(session).toBeDefined();
    expect(session?.status).toBe('UPCOMING');
  });

  it('menyembunyikan tautan gabung setelah sesi berakhir', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    // Mulai tiga jam lalu, durasi 60 menit, jadi sudah usai.
    const id = await schedule(master.cookie, master.csrfToken, new Date(Date.now() - 3 * HOUR), 60);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const response = await request(h.server)
      .get(`${prefix}/learn/courses/${courseId}/live-sessions`)
      .set('Cookie', student.cookie)
      .expect(200);

    const session = (response.body.data as Array<Record<string, unknown>>).find(
      (item) => item.id === id,
    );
    expect(session?.status).toBe('ENDED');
    // Tautan lama tidak boleh terus beredar setelah kelasnya selesai.
    expect(session?.joinUrl).toBeNull();
  });

  it('menolak jadwal kursus yang tidak dimiliki pelajar', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);

    await request(h.server)
      .get(`${prefix}/learn/courses/${draftCourseId}/live-sessions`)
      .set('Cookie', student.cookie)
      .expect(404);
  });

  it('menolak tautan dari penyedia di luar daftar', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);

    const response = await request(h.server)
      .post(`${prefix}/admin/live-sessions`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({
        courseId,
        title: 'Sesi dengan tautan asing',
        joinUrl: 'https://zoom.us.phishing.test/j/1',
        startsAt: new Date(Date.now() + HOUR).toISOString(),
        durationMinutes: 60,
      })
      .expect(422);
    expect(JSON.stringify(response.body.error.fields)).toContain('joinUrl');
  });

  it('menolak pelajar menjadwalkan atau membatalkan sesi', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);

    await request(h.server)
      .get(`${prefix}/admin/live-sessions`)
      .set('Cookie', student.cookie)
      .expect(403);

    await request(h.server)
      .post(`${prefix}/admin/live-sessions`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({
        courseId,
        title: 'Percobaan tidak sah',
        joinUrl: 'https://zoom.us/j/1',
        startsAt: new Date(Date.now() + HOUR).toISOString(),
        durationMinutes: 60,
      })
      .expect(403);
  });

  it('menghilangkan sesi yang dibatalkan dari jadwal pelajar', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const id = await schedule(master.cookie, master.csrfToken, new Date(Date.now() + 48 * HOUR));

    await request(h.server)
      .delete(`${prefix}/admin/live-sessions/${id}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(204);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const response = await request(h.server)
      .get(`${prefix}/learn/courses/${courseId}/live-sessions`)
      .set('Cookie', student.cookie)
      .expect(200);

    expect((response.body.data as Array<{ id: string }>).map((item) => item.id)).not.toContain(id);
  });
});
