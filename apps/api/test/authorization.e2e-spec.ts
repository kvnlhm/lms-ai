import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Otorisasi resource', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('tidak menampilkan kursus draf di katalog', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);

    const response = await request(h.server)
      .get(`${prefix}/courses`)
      .set('Cookie', session.cookie)
      .expect(200);

    const slugs = (response.body.data as Array<{ slug: string }>).map((course) => course.slug);
    expect(slugs).toContain('video-editing-mastery');
    // Kursus berstatus DRAFT tidak boleh bocor lewat katalog.
    expect(slugs).not.toContain('generative-ai-mastery');
  });

  it('mengembalikan 404 untuk kursus draf yang diminta langsung', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const draft = await h.prisma.course.findUniqueOrThrow({
      where: { slug: 'generative-ai-mastery' },
      select: { id: true },
    });

    // 404, bukan 403: keberadaan kursus yang belum terbit tidak boleh
    // dapat disimpulkan oleh Pelajar.
    await request(h.server)
      .get(`${prefix}/courses/${draft.id}`)
      .set('Cookie', session.cookie)
      .expect(404);
  });

  it('menolak akses materi pada kursus yang tidak diikuti', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);

    // Kursus baru tanpa enrollment untuk pengguna ini.
    const course = await h.prisma.course.create({
      data: {
        slug: `kursus-tanpa-akses-${Date.now()}`,
        title: 'Kursus Tanpa Akses',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    try {
      const response = await request(h.server)
        .get(`${prefix}/learn/courses/${course.id}`)
        .set('Cookie', session.cookie)
        .expect(404);

      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    } finally {
      await h.prisma.course.delete({ where: { id: course.id } });
    }
  });

  it('menolak akses ketika masa berlaku enrollment sudah lewat', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: session.userId, course: { slug: 'video-editing-mastery' } },
    });

    await h.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { accessEndsAt: new Date(Date.now() - 60_000) },
    });

    try {
      const response = await request(h.server)
        .get(`${prefix}/learn/courses/${enrollment.courseId}`)
        .set('Cookie', session.cookie)
        .expect(403);

      expect(response.body.error.code).toBe('ENROLLMENT_INACTIVE');
    } finally {
      await h.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { accessEndsAt: null },
      });
    }
  });

  it('tidak mengizinkan pencabutan perangkat milik pengguna lain', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const other = await login(h.server, 'samuel@akademionline.id', 'Pelajar#Lokal12345');

    const devices = await request(h.server)
      .get(`${prefix}/auth/sessions`)
      .set('Cookie', other.cookie)
      .expect(200);

    const foreignDeviceId = (devices.body.data as Array<{ id: string }>)[0]?.id;
    expect(foreignDeviceId).toBeDefined();

    // 404 karena kueri difilter berdasarkan pemilik: mengetahui ID tidak
    // memberi hak, dan keberadaannya tidak dikonfirmasi.
    await request(h.server)
      .delete(`${prefix}/auth/sessions/${foreignDeviceId}`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .expect(404);
  });
});
