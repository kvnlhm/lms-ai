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

  it('membuatkan akses otomatis pada kursus terbit yang belum pernah dibuka', async () => {
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
      // Sejak konten terbit dibuka untuk seluruh pengguna terautentikasi,
      // enrollment berhenti menjadi gerbang dan tinggal menjadi wadah progres:
      // ia dibuatkan saat kursusnya pertama kali dibuka.
      await request(h.server)
        .get(`${prefix}/learn/courses/${course.id}`)
        .set('Cookie', session.cookie)
        .expect(200);

      const enrollment = await h.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId: course.id } },
        select: { status: true },
      });
      expect(enrollment?.status).toBe('ACTIVE');
    } finally {
      await h.prisma.courseProgress.deleteMany({ where: { enrollment: { courseId: course.id } } });
      await h.prisma.enrollment.deleteMany({ where: { courseId: course.id } });
      await h.prisma.course.delete({ where: { id: course.id } });
    }
  });

  it('menolak kursus terbit untuk permintaan tanpa sesi', async () => {
    const course = await h.prisma.course.findFirstOrThrow({
      where: { slug: 'video-editing-mastery' },
      select: { id: true },
    });

    // Gerbangnya kini autentikasi, bukan enrollment. Justru karena itu batas
    // ini yang harus dijaga: tanpa sesi, tidak ada satu pun materi yang terbuka.
    const response = await request(h.server).get(`${prefix}/learn/courses/${course.id}`).expect(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('masa berlaku lama pada baris enrollment tidak lagi menutup akses', async () => {
    // Akses kursus terbit bersifat permanen. Kolom masa berlaku masih ada di
    // basis data untuk baris lama, jadi test ini memasang nilai yang sudah
    // lewat lalu membuktikan dua hal sekaligus: aksesnya tetap terbuka, dan
    // nilainya memang tidak dibaca — bukan sekadar kebetulan dihapus.
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: session.userId, course: { slug: 'video-editing-mastery' } },
    });
    const kedaluwarsa = new Date(Date.now() - 60_000);

    await h.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'EXPIRED', accessEndsAt: kedaluwarsa },
    });

    try {
      await request(h.server)
        .get(`${prefix}/learn/courses/${enrollment.courseId}`)
        .set('Cookie', session.cookie)
        .expect(200);

      const setelah = await h.prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollment.id },
        select: { status: true, accessEndsAt: true },
      });
      // Statusnya dipulihkan pada baris yang sama, sehingga progres yang sudah
      // tercatat tidak hilang.
      expect(setelah.status).toBe('ACTIVE');
      // Nilainya dibiarkan apa adanya. Kalau kelak ada yang menegakkan kembali
      // masa berlaku, test ini akan gagal dan memaksa keputusannya dibicarakan.
      expect(setelah.accessEndsAt?.getTime()).toBe(kedaluwarsa.getTime());
    } finally {
      await h.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: enrollment.status, accessEndsAt: null },
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
