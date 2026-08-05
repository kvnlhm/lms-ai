import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Penyusunan kursus oleh Master', () => {
  let h: Harness;
  let master: Awaited<ReturnType<typeof login>>;
  const createdCourseIds: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
  });

  afterAll(async () => {
    // Kursus uji dibersihkan agar katalog lokal tidak dipenuhi sisa test.
    for (const id of createdCourseIds) {
      await h.prisma.lessonProgress.deleteMany({ where: { lesson: { module: { courseId: id } } } });
      await h.prisma.courseProgress.deleteMany({ where: { enrollment: { courseId: id } } });
      await h.prisma.enrollment.deleteMany({ where: { courseId: id } });
      await h.prisma.course.deleteMany({ where: { id } });
    }
    await h.close();
  });

  function asMaster(method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string) {
    return request(h.server)
      [method](`${prefix}${path}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken);
  }

  async function createCourse(slug: string): Promise<string> {
    const response = await asMaster('post', '/admin/courses')
      .send({ title: `Kursus ${slug}`, slug, level: 'BEGINNER' })
      .expect(201);
    createdCourseIds.push(response.body.data.id);
    return response.body.data.id;
  }

  it('membuat kursus baru selalu berstatus draf', async () => {
    const slug = `uji-draf-${Date.now()}`;
    const response = await asMaster('post', '/admin/courses')
      .send({ title: 'Uji Draf', slug, level: 'BEGINNER' })
      .expect(201);

    createdCourseIds.push(response.body.data.id);
    expect(response.body.data.status).toBe('DRAFT');
    expect(response.body.data.publishedAt).toBeNull();
  });

  it('menerima seluruh kolom pengaturan saat kursus dibuat', async () => {
    const categories = await asMaster('get', '/admin/course-categories').expect(200);
    const categoryId = (categories.body.data as Array<{ id: string }>)[0]!.id;
    const slug = `uji-lengkap-${Date.now()}`;

    // Validasi API memakai forbidNonWhitelisted, jadi satu nama kolom yang
    // meleset menolak seluruh permintaan — bukan mengabaikan kolomnya saja.
    // Formulir "Tambahkan Kursus" mengirim ketujuh kolom ini sekaligus.
    const dibuat = await asMaster('post', '/admin/courses')
      .send({
        title: 'Kursus Lengkap',
        slug,
        level: 'INTERMEDIATE',
        categoryId,
        shortDescription: 'Ringkasan singkat',
        description: 'Deskripsi lengkap kursus.',
        estimatedMinutes: 90,
      })
      .expect(201);
    createdCourseIds.push(dibuat.body.data.id);

    const detail = await asMaster('get', `/admin/courses/${dibuat.body.data.id}`).expect(200);
    expect(detail.body.data.level).toBe('INTERMEDIATE');
    expect(detail.body.data.shortDescription).toBe('Ringkasan singkat');
    expect(detail.body.data.description).toBe('Deskripsi lengkap kursus.');
    expect(detail.body.data.estimatedMinutes).toBe(90);
    expect(detail.body.data.category?.id).toBe(categoryId);
  });

  it('menyediakan kategori dan dapat memasangnya pada kursus', async () => {
    const categories = await asMaster('get', '/admin/course-categories').expect(200);
    expect(categories.body.data.length).toBeGreaterThanOrEqual(5);
    const categoryId = categories.body.data[0].id as string;
    const courseId = await createCourse(`uji-kategori-${Date.now()}`);

    await asMaster('patch', `/admin/courses/${courseId}`)
      .send({ categoryId })
      .expect(200);

    const detail = await asMaster('get', `/admin/courses/${courseId}`).expect(200);
    expect(detail.body.data.categoryId).toBe(categoryId);
    expect(detail.body.data.category.id).toBe(categoryId);
  });

  it('menyaring daftar kursus menurut kata pencarian', async () => {
    const penanda = `Zebrafish${Date.now()}`;
    await asMaster('post', '/admin/courses')
      .send({ title: `Kursus ${penanda}`, slug: `uji-cari-${Date.now()}`, level: 'BEGINNER' })
      .expect(201)
      .then((r) => createdCourseIds.push(r.body.data.id));

    // Parameter `search` sudah didukung sejak lama tetapi tidak pernah diuji,
    // dan kolomnya baru sekarang tampil di halaman kelola kursus.
    const hasil = await asMaster('get', `/admin/courses?search=${penanda.toLowerCase()}`).expect(200);
    const judul = (hasil.body.data as Array<{ title: string }>).map((item) => item.title);
    expect(judul).toHaveLength(1);
    expect(judul[0]).toContain(penanda);

    const kosong = await asMaster('get', '/admin/courses?search=zzzkatatidakada').expect(200);
    expect(kosong.body.data).toHaveLength(0);
  });

  it('menolak slug yang sudah dipakai', async () => {
    const slug = `uji-duplikat-${Date.now()}`;
    await createCourse(slug);

    const response = await asMaster('post', '/admin/courses')
      .send({ title: 'Duplikat', slug, level: 'BEGINNER' })
      .expect(422);

    expect(response.body.error.fields.slug).toBeDefined();
  });

  it('menolak slug yang tidak sesuai format', async () => {
    const response = await asMaster('post', '/admin/courses')
      .send({ title: 'Slug Salah', slug: 'Huruf Besar Dan Spasi', level: 'BEGINNER' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('mengunggah, mengganti, menyajikan, dan menghapus thumbnail kursus', async () => {
    const courseId = await createCourse(`uji-thumbnail-${Date.now()}`);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('course-thumbnail-test'),
    ]);

    const uploaded = await asMaster('put', `/admin/courses/${courseId}/thumbnail`)
      .set('Content-Type', 'image/png')
      .send(png)
      .expect(200);

    expect(uploaded.body.data.thumbnailUrl).toMatch(
      /^\/api\/v1\/courses\/thumbnails\/.+\.png$/,
    );
    const thumbnailPath = uploaded.body.data.thumbnailUrl as string;
    const image = await request(h.server).get(thumbnailPath).expect(200);
    expect(image.headers['content-type']).toMatch(/^image\/png/);
    expect(image.body).toEqual(png);

    const detail = await asMaster('get', `/admin/courses/${courseId}`).expect(200);
    expect(detail.body.data.thumbnailUrl).toBe(thumbnailPath);

    await asMaster('put', `/admin/courses/${courseId}/thumbnail`)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('bukan-png'))
      .expect(422);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await request(h.server)
      .put(`${prefix}/admin/courses/${courseId}/thumbnail`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .set('Content-Type', 'image/png')
      .send(png)
      .expect(403);

    await asMaster('delete', `/admin/courses/${courseId}/thumbnail`).expect(204);
    await request(h.server).get(thumbnailPath).expect(404);
  });

  it('menghapus kursus yang belum pernah memiliki enrollment', async () => {
    const courseId = await createCourse(`uji-hapus-${Date.now()}`);
    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian' })
        .expect(201)
    ).body.data.id as string;
    await asMaster('post', `/admin/modules/${moduleId}/lessons`)
      .send({ title: 'Pelajaran', contentType: 'TEXT' })
      .expect(201);

    await asMaster('delete', `/admin/courses/${courseId}`).expect(204);

    await asMaster('get', `/admin/courses/${courseId}`).expect(404);
    // Bagian dan pelajarannya ikut terhapus lewat cascade, tidak menggantung.
    expect(await h.prisma.courseModule.count({ where: { courseId } })).toBe(0);
    expect(await h.prisma.lesson.count({ where: { module: { courseId } } })).toBe(0);
  });

  it('menghapus kursus beserta riwayatnya ketika force diminta', async () => {
    const courseId = await createCourse(`uji-hapus-paksa-${Date.now()}`);
    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian' })
        .expect(201)
    ).body.data.id as string;
    await asMaster('post', `/admin/modules/${moduleId}/lessons`)
      .send({ title: 'Pelajaran', contentType: 'TEXT' })
      .expect(201);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await asMaster('post', `/admin/courses/${courseId}/enrollments`)
      .send({ userIds: [student.userId] })
      .expect(200);

    // Tanpa force, penolakannya tetap berlaku: itu tetap jalur bawaannya.
    await asMaster('delete', `/admin/courses/${courseId}`).expect(409);

    await asMaster('delete', `/admin/courses/${courseId}?force=true`).expect(204);

    await asMaster('get', `/admin/courses/${courseId}`).expect(404);
    // Enrollment memakai RESTRICT, bukan cascade — bila tidak dibereskan
    // sendiri, penghapusan kursusnya akan gagal di tingkat basis data.
    expect(await h.prisma.enrollment.count({ where: { courseId } })).toBe(0);
    expect(await h.prisma.courseModule.count({ where: { courseId } })).toBe(0);
  });

  it('mencatat besaran akibat penghapusan paksa ke audit log', async () => {
    const courseId = await createCourse(`uji-audit-paksa-${Date.now()}`);
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await asMaster('post', `/admin/courses/${courseId}/enrollments`)
      .send({ userIds: [student.userId] })
      .expect(200);

    await asMaster('delete', `/admin/courses/${courseId}?force=true`).expect(204);

    // Audit log harus dapat menjawab berapa riwayat belajar yang ikut lenyap,
    // bukan sekadar bahwa sebuah kursus dihapus.
    const catatan = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'course.deleted', targetId: courseId },
      orderBy: { createdAt: 'desc' },
    });
    const sesudah = catatan.afterData as Record<string, unknown>;
    expect(sesudah.forced).toBe(true);
    expect(sesudah.enrollmentsDeleted).toBe(1);
  });

  it('menolak penerbitan kursus kosong dan menyebut seluruh alasannya', async () => {
    const courseId = await createCourse(`uji-kosong-${Date.now()}`);

    const response = await asMaster('post', `/admin/courses/${courseId}/publish`).expect(422);

    expect(response.body.error.fields.course).toHaveLength(3);
  });

  it('menolak penerbitan bila tidak ada pelajaran wajib', async () => {
    const courseId = await createCourse(`uji-tanpa-wajib-${Date.now()}`);

    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian Satu' })
        .expect(201)
    ).body.data.id;

    await asMaster('post', `/admin/modules/${moduleId}/lessons`)
      .send({ title: 'Pelajaran Opsional', contentType: 'TEXT', isRequired: false })
      .expect(201);

    const response = await asMaster('post', `/admin/courses/${courseId}/publish`).expect(422);
    expect(response.body.error.fields.course).toEqual([
      'Kursus harus memiliki minimal satu pelajaran wajib.',
    ]);
  });

  it('menerbitkan kursus yang sudah lengkap dan memunculkannya di katalog', async () => {
    const slug = `uji-terbit-${Date.now()}`;
    const courseId = await createCourse(slug);

    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian Satu' })
        .expect(201)
    ).body.data.id;

    await asMaster('post', `/admin/modules/${moduleId}/lessons`)
      .send({ title: 'Pelajaran Wajib', contentType: 'TEXT', isRequired: true })
      .expect(201);

    const published = await asMaster('post', `/admin/courses/${courseId}/publish`).expect(200);
    expect(published.body.data.status).toBe('PUBLISHED');

    // Pelajar kini melihatnya di katalog publik.
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const catalog = await request(h.server)
      .get(`${prefix}/courses?pageSize=100`)
      .set('Cookie', student.cookie)
      .expect(200);

    expect((catalog.body.data as Array<{ slug: string }>).map((c) => c.slug)).toContain(slug);
  });

  it('menyembunyikan kembali kursus yang diarsipkan dari katalog', async () => {
    const slug = `uji-arsip-${Date.now()}`;
    const courseId = await createCourse(slug);

    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian' })
        .expect(201)
    ).body.data.id;
    await asMaster('post', `/admin/modules/${moduleId}/lessons`)
      .send({ title: 'Pelajaran', contentType: 'TEXT' })
      .expect(201);
    await asMaster('post', `/admin/courses/${courseId}/publish`).expect(200);
    await asMaster('post', `/admin/courses/${courseId}/archive`).expect(200);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const catalog = await request(h.server)
      .get(`${prefix}/courses?pageSize=100`)
      .set('Cookie', student.cookie)
      .expect(200);

    expect((catalog.body.data as Array<{ slug: string }>).map((c) => c.slug)).not.toContain(slug);
  });

  // ── Urutan katalog ──────────────────────────────────────────
  //
  // Seluruh urutan bercakupan satu tabel, bukan satu kursus, jadi test di
  // bawah ini menyusun ulang katalog yang sama yang dipakai test lain. Aman
  // karena e2e berjalan `--runInBand` dan tidak ada test lain yang bergantung
  // pada urutan katalog — semuanya memeriksa keanggotaan, bukan posisi.

  /** Seluruh id kursus menurut urutan tampilnya sekarang. */
  async function urutanSekarang(): Promise<string[]> {
    const rows = await h.prisma.course.findMany({
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  it('menempatkan kursus baru di ekor urutan, bukan di kepala', async () => {
    // Bawaan kolomnya nol, dan nol berarti paling depan. Tanpa penetapan
    // eksplisit saat pembuatan, setiap kursus baru — yang bahkan belum punya
    // satu pun bagian — akan memimpin katalog begitu diterbitkan.
    const sebelum = await h.prisma.course.aggregate({ _max: { position: true } });
    const courseId = await createCourse(`uji-ekor-${Date.now()}`);

    const dibuat = await h.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { position: true },
    });
    expect(dibuat.position).toBe((sebelum._max.position ?? 0) + 1);
  });

  it('menyusun ulang katalog dan katalog pelajar mengikutinya', async () => {
    const slug = `uji-urut-katalog-${Date.now()}`;
    const courseId = await createCourse(slug);
    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian Satu' })
        .expect(201)
    ).body.data.id;
    await asMaster('post', `/admin/modules/${moduleId}/lessons`)
      .send({ title: 'Pelajaran Wajib', contentType: 'TEXT', isRequired: true })
      .expect(201);
    await asMaster('post', `/admin/courses/${courseId}/publish`).expect(200);

    // Kursus ini baru dibuat, jadi ia berada di ekor. Dipindahkan ke kepala.
    const semua = await urutanSekarang();
    const baru = [courseId, ...semua.filter((id) => id !== courseId)];
    const response = await asMaster('put', '/admin/courses/order')
      .send({ ids: baru })
      .expect(200);
    expect(response.body.data.reordered).toBe(baru.length);

    expect(await urutanSekarang()).toEqual(baru);

    // Yang sesungguhnya diuji: pelajar melihat urutan itu, bukan urutan terbit.
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const catalog = await request(h.server)
      .get(`${prefix}/courses?pageSize=100`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect((catalog.body.data as Array<{ slug: string }>)[0]!.slug).toBe(slug);
  });

  it('menolak urutan yang tidak memuat seluruh kursus', async () => {
    // Urutannya satu untuk seluruh tabel. Menerima sebagian saja berarti
    // menerima urutan berlubang: kursus yang tidak disebut mempertahankan nomor
    // lamanya dan bertabrakan dengan nomor baru milik kursus lain.
    const semua = await urutanSekarang();
    expect(semua.length).toBeGreaterThan(1);

    const response = await asMaster('put', '/admin/courses/order')
      .send({ ids: semua.slice(0, 1) })
      .expect(422);

    expect(response.body.error.fields.order).toBeDefined();
  });

  it('tidak menandai kursus sebagai baru disunting hanya karena urutannya digeser', async () => {
    // Kolom "Diperbarui" di halaman Master membaca `updatedAt`. Menyusun urutan
    // lewat klien Prisma akan menyentuh kolom itu pada setiap kursus sekaligus,
    // sehingga seluruh katalog terbaca seolah baru saja disunting isinya.
    const semua = await urutanSekarang();
    const sebelum = await h.prisma.course.findUniqueOrThrow({
      where: { id: semua[0]! },
      select: { updatedAt: true },
    });

    await asMaster('put', '/admin/courses/order')
      .send({ ids: [...semua].reverse() })
      .expect(200);

    const sesudah = await h.prisma.course.findUniqueOrThrow({
      where: { id: semua[0]! },
      select: { updatedAt: true },
    });
    expect(sesudah.updatedAt).toEqual(sebelum.updatedAt);

    // Dikembalikan supaya test berikutnya tidak mewarisi katalog terbalik.
    await asMaster('put', '/admin/courses/order').send({ ids: semua }).expect(200);
  });

  it('memberi posisi berurutan pada bagian tanpa diminta klien', async () => {
    const courseId = await createCourse(`uji-posisi-${Date.now()}`);

    const first = await asMaster('post', `/admin/courses/${courseId}/modules`)
      .send({ title: 'Pertama' })
      .expect(201);
    const second = await asMaster('post', `/admin/courses/${courseId}/modules`)
      .send({ title: 'Kedua' })
      .expect(201);

    expect(first.body.data.position).toBe(1);
    expect(second.body.data.position).toBe(2);
  });

  it('menukar urutan bagian tanpa melanggar constraint unik', async () => {
    const courseId = await createCourse(`uji-urutan-${Date.now()}`);

    const a = (
      await asMaster('post', `/admin/courses/${courseId}/modules`).send({ title: 'Bagian A' }).expect(201)
    ).body.data.id;
    const b = (
      await asMaster('post', `/admin/courses/${courseId}/modules`).send({ title: 'Bagian B' }).expect(201)
    ).body.data.id;
    const c = (
      await asMaster('post', `/admin/courses/${courseId}/modules`).send({ title: 'Bagian C' }).expect(201)
    ).body.data.id;

    await asMaster('put', `/admin/courses/${courseId}/modules/order`)
      .send({ ids: [c, a, b] })
      .expect(200);

    const detail = await asMaster('get', `/admin/courses/${courseId}`).expect(200);
    expect((detail.body.data.modules as Array<{ id: string }>).map((m) => m.id)).toEqual([c, a, b]);
  });

  it('menolak urutan yang tidak memuat seluruh bagian', async () => {
    const courseId = await createCourse(`uji-urutan-tak-lengkap-${Date.now()}`);

    const a = (
      await asMaster('post', `/admin/courses/${courseId}/modules`).send({ title: 'Bagian A' }).expect(201)
    ).body.data.id;
    await asMaster('post', `/admin/courses/${courseId}/modules`).send({ title: 'Bagian B' }).expect(201);

    const response = await asMaster('put', `/admin/courses/${courseId}/modules/order`)
      .send({ ids: [a] })
      .expect(422);

    expect(response.body.error.fields.order).toBeDefined();
  });

  it('menolak penghapusan pelajaran yang sudah punya riwayat belajar', async () => {
    const slug = `uji-hapus-${Date.now()}`;
    const courseId = await createCourse(slug);

    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian' })
        .expect(201)
    ).body.data.id;
    const lessonId = (
      await asMaster('post', `/admin/modules/${moduleId}/lessons`)
        .send({ title: 'Pelajaran', contentType: 'TEXT' })
        .expect(201)
    ).body.data.id;
    await asMaster('post', `/admin/courses/${courseId}/publish`).expect(200);

    // Beri akses ke pelajar lalu biarkan dia menyelesaikannya.
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await asMaster('post', `/admin/courses/${courseId}/enrollments`)
      .send({ userIds: [student.userId] })
      .expect(200);
    await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonId}/complete`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({})
      .expect(200);

    const response = await asMaster('delete', `/admin/lessons/${lessonId}`).expect(409);
    expect(response.body.error.message).toContain('riwayat belajar');
  });

  it('menolak penghapusan kursus yang sudah memiliki enrollment', async () => {
    const courseId = await createCourse(`uji-hapus-kursus-${Date.now()}`);
    const student = await login(h.server, STUDENT.email, STUDENT.password);

    await asMaster('post', `/admin/courses/${courseId}/enrollments`)
      .send({ userIds: [student.userId] })
      .expect(200);

    const response = await asMaster('delete', `/admin/courses/${courseId}`).expect(409);
    expect(response.body.error.message).toContain('arsip');
  });

  it('mencatat tindakan Master ke audit log', async () => {
    const before = await h.prisma.auditLog.count({ where: { action: 'course.created' } });
    await createCourse(`uji-audit-${Date.now()}`);
    const after = await h.prisma.auditLog.count({ where: { action: 'course.created' } });

    expect(after).toBe(before + 1);

    const entry = await h.prisma.auditLog.findFirst({
      where: { action: 'course.created' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry?.actorUserId).toBe(master.userId);
    expect(entry?.requestId).toEqual(expect.any(String));
  });
});
