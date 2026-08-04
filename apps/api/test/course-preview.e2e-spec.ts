import request from 'supertest';
import { PublicationStatus } from '@prisma/client';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

/**
 * Pratinjau kursus yang belum terbit.
 *
 * Yang diuji di sini bukan sekadar "Master dapat 200". Yang diuji adalah bahwa
 * hak itu berhenti tepat pada batasnya: pelajar tetap tidak tahu kursusnya ada,
 * katalog tidak ikut berubah, dan draf tidak menyusup ke daftar kursus siapa
 * pun. Tanpa batas-batas itu, satu tombol pratinjau berubah menjadi kebocoran
 * seluruh materi yang belum siap.
 */
describe('Pratinjau kursus belum terbit', () => {
  let h: Harness;
  let master: Awaited<ReturnType<typeof login>>;
  let student: Awaited<ReturnType<typeof login>>;

  let draftCourseId = '';
  let draftLessonId = '';
  let publishedCourseId = '';

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
    student = await login(h.server, STUDENT.email, STUDENT.password);

    const draft = await h.prisma.course.create({
      data: {
        slug: `uji-pratinjau-${Date.now()}`,
        title: 'Kursus Uji Pratinjau',
        shortDescription: 'Belum terbit.',
        status: PublicationStatus.DRAFT,
        modules: {
          create: {
            title: 'Bagian satu',
            position: 1,
            lessons: {
              create: {
                title: 'Pelajaran satu',
                position: 1,
                contentType: 'TEXT',
                textContent: 'Isi pelajaran draf.',
                isRequired: true,
              },
            },
          },
        },
      },
      include: { modules: { include: { lessons: true } } },
    });
    draftCourseId = draft.id;
    draftLessonId = draft.modules[0]!.lessons[0]!.id;

    publishedCourseId = (
      await h.prisma.course.findFirstOrThrow({
        where: { status: PublicationStatus.PUBLISHED },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    if (draftCourseId) {
      // Enrollment pratinjau ikut dibuat oleh jalur akses, jadi ikut dibersihkan.
      const enrollments = await h.prisma.enrollment.findMany({
        where: { courseId: draftCourseId },
        select: { id: true },
      });
      await h.prisma.courseProgress.deleteMany({
        where: { enrollmentId: { in: enrollments.map((row) => row.id) } },
      });
      await h.prisma.lessonProgress.deleteMany({
        where: { enrollmentId: { in: enrollments.map((row) => row.id) } },
      });
      await h.prisma.enrollment.deleteMany({ where: { courseId: draftCourseId } });
      await h.prisma.lesson.deleteMany({ where: { module: { courseId: draftCourseId } } });
      await h.prisma.courseModule.deleteMany({ where: { courseId: draftCourseId } });
      await h.prisma.course.delete({ where: { id: draftCourseId } });
    }
    await h.close();
  });

  function sebagai(sesi: Awaited<ReturnType<typeof login>>, path: string) {
    return request(h.server).get(`${prefix}${path}`).set('Cookie', sesi.cookie);
  }

  it('menolak pelajar dengan 404, bukan 403', async () => {
    // 403 akan memberi tahu bahwa kursusnya ada. Yang belum terbit tidak boleh
    // dapat dipetakan keberadaannya oleh orang yang tidak berhak melihatnya.
    const response = await sebagai(student, `/courses/${draftCourseId}`).expect(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('menutup pelajarannya juga bagi pelajar', async () => {
    await sebagai(student, `/learn/lessons/${draftLessonId}`).expect(404);
    await sebagai(student, `/learn/courses/${draftCourseId}`).expect(404);
  });

  it('membuka detail kursus untuk penyusun dan menandainya pratinjau', async () => {
    const response = await sebagai(master, `/courses/${draftCourseId}`).expect(200);
    expect(response.body.data.id).toBe(draftCourseId);
    expect(response.body.data.access.preview).toBe(true);
  });

  it('membuka kurikulum dan isi pelajaran untuk penyusun', async () => {
    const kursus = await sebagai(master, `/learn/courses/${draftCourseId}`).expect(200);
    expect(kursus.body.data.course.preview).toBe(true);
    expect(kursus.body.data.totalLessons).toBe(1);

    const pelajaran = await sebagai(master, `/learn/lessons/${draftLessonId}`).expect(200);
    expect(pelajaran.body.data.content.text).toBe('Isi pelajaran draf.');
  });

  it('tidak menandai kursus terbit sebagai pratinjau', async () => {
    // Kalau penanda ini menyala untuk kursus biasa, spanduk "belum terbit"
    // akan muncul di depan pelajar pada kursus yang justru sudah tayang.
    const response = await sebagai(master, `/courses/${publishedCourseId}`).expect(200);
    expect(response.body.data.access.preview).toBe(false);
  });

  it('tidak memasukkan draf ke katalog, bahkan bagi penyusun', async () => {
    const response = await sebagai(master, '/courses?page=1&pageSize=100').expect(200);
    const ids = (response.body.data as Array<{ id: string }>).map((item) => item.id);
    expect(ids).not.toContain(draftCourseId);
  });

  it('tidak memasukkan draf ke daftar kursus penyusun meski sudah dipratinjau', async () => {
    // Pratinjau memakai jalur akses yang sama dengan pelajar, jadi ia ikut
    // membuat baris enrollment. Baris itu tidak boleh sampai terlihat sebagai
    // "kursus yang sedang saya ikuti".
    const response = await sebagai(master, '/me/enrollments').expect(200);
    const ids = (response.body.data as Array<{ course: { id: string } }>).map(
      (item) => item.course.id,
    );
    expect(ids).not.toContain(draftCourseId);
  });
});
