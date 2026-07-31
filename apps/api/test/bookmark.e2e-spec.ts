import request from 'supertest';
import { firstLessonOf, login, prefix, startHarness, type Harness, type Session } from './support/harness';

const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };
const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };

describe('Bookmark materi', () => {
  let h: Harness;
  let student: Session;
  let lessonId: string;
  let courseSlug: string;

  beforeAll(async () => {
    h = await startHarness();
    student = await login(h.server, STUDENT.email, STUDENT.password);

    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: student.userId, status: 'ACTIVE' },
      select: { course: { select: { slug: true } } },
    });
    courseSlug = enrollment.course.slug;
    lessonId = await firstLessonOf(h.prisma, courseSlug);
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    await h.prisma.userBookmark.deleteMany({ where: { userId: student.userId } });
  });

  const tandai = (note?: string) =>
    request(h.server)
      .put(`${prefix}/learn/lessons/${lessonId}/bookmark`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send(note === undefined ? {} : { note });

  it('menandai materi dan menampilkannya pada daftar', async () => {
    const response = await tandai().expect(200);
    expect(response.body.data).toEqual({ bookmarked: true });

    const daftar = await request(h.server)
      .get(`${prefix}/me/bookmarks`)
      .set('Cookie', student.cookie)
      .expect(200);

    expect(daftar.body.data).toHaveLength(1);
    expect(daftar.body.data[0].lessonId).toBe(lessonId);
    expect(daftar.body.data[0].courseTitle).toBeTruthy();
    expect(daftar.body.data[0].moduleTitle).toBeTruthy();
  });

  it('menandai dua kali tidak menggandakan maupun gagal', async () => {
    await tandai().expect(200);
    await tandai().expect(200);

    const daftar = await request(h.server)
      .get(`${prefix}/me/bookmarks`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(daftar.body.data).toHaveLength(1);
  });

  it('memperbarui catatan ketika ditandai ulang', async () => {
    await tandai('catatan pertama').expect(200);
    await tandai('catatan kedua').expect(200);

    const row = await h.prisma.userBookmark.findFirstOrThrow({
      where: { userId: student.userId, lessonId },
    });
    expect(row.note).toBe('catatan kedua');
  });

  it('melepas tanda', async () => {
    await tandai().expect(200);

    const response = await request(h.server)
      .delete(`${prefix}/learn/lessons/${lessonId}/bookmark`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .expect(200);
    expect(response.body.data).toEqual({ bookmarked: false });

    const daftar = await request(h.server)
      .get(`${prefix}/me/bookmarks`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(daftar.body.data).toHaveLength(0);
  });

  it('melepas tanda yang tidak ada tetap berhasil', async () => {
    // Hasil akhirnya sama — materi itu tidak ditandai. Membedakannya hanya
    // membuat tombol di antarmuka gagal karena hal yang tidak perlu.
    await request(h.server)
      .delete(`${prefix}/learn/lessons/${lessonId}/bookmark`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .expect(200);
  });

  it('menolak menandai materi dari kursus yang tidak diikuti', async () => {
    const luar = await h.prisma.lesson.findFirst({
      where: { module: { course: { enrollments: { none: { userId: student.userId } } } } },
      select: { id: true },
    });
    if (!luar) return;

    // Tanpa pemeriksaan ini, daftar bookmark menjadi cara memanen judul materi
    // dari kursus yang tidak dibayar.
    await request(h.server)
      .put(`${prefix}/learn/lessons/${luar.id}/bookmark`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({})
      .expect(403);
  });

  it('tidak memperlihatkan bookmark milik orang lain', async () => {
    await tandai().expect(200);

    const master = await login(h.server, MASTER.email, MASTER.password);
    const daftar = await request(h.server)
      .get(`${prefix}/me/bookmarks`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(daftar.body.data).toHaveLength(0);
  });

  it('menolak tanpa sesi', async () => {
    await request(h.server).get(`${prefix}/me/bookmarks`).expect(401);
    await request(h.server)
      .put(`${prefix}/learn/lessons/${lessonId}/bookmark`)
      .send({})
      .expect(401);
  });

  it('menolak mutasi tanpa token CSRF', async () => {
    await request(h.server)
      .put(`${prefix}/learn/lessons/${lessonId}/bookmark`)
      .set('Cookie', student.cookie)
      .send({})
      .expect(403);
  });

  it('menolak catatan yang kepanjangan', async () => {
    await tandai('x'.repeat(600)).expect(422);
  });

  it('menyembunyikan bookmark ke materi yang dinonaktifkan', async () => {
    await tandai().expect(200);
    await h.prisma.lesson.update({ where: { id: lessonId }, data: { isActive: false } });

    try {
      const daftar = await request(h.server)
        .get(`${prefix}/me/bookmarks`)
        .set('Cookie', student.cookie)
        .expect(200);
      // Menampilkannya hanya akan memberi tautan yang berujung 404.
      expect(daftar.body.data).toHaveLength(0);
    } finally {
      await h.prisma.lesson.update({ where: { id: lessonId }, data: { isActive: true } });
    }
  });
});
