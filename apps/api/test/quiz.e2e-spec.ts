import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

interface SoalTersimpan {
  id: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
}

describe('Kuis pada kursus', () => {
  let h: Harness;
  let master: Awaited<ReturnType<typeof login>>;
  let student: Awaited<ReturnType<typeof login>>;
  const courseIds: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
    student = await login(h.server, STUDENT.email, STUDENT.password);
  });

  afterAll(async () => {
    // Sisa kursus uji dibersihkan supaya spec lain tidak menemukan draf asing
    // di katalog. Kuis, soal, dan percobaan ikut terhapus lewat cascade.
    for (const id of courseIds) {
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

  function asStudent(method: 'get' | 'post', path: string) {
    return request(h.server)
      [method](`${prefix}${path}`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken);
  }

  /** Kursus terbit berisi satu pelajaran kuis, dan pelajar sudah terdaftar. */
  async function siapkanKursusKuis(
    label: string,
    quiz: Record<string, unknown>,
  ): Promise<{ courseId: string; lessonId: string; questions: SoalTersimpan[] }> {
    const courseId = (
      await asMaster('post', '/admin/courses')
        .send({ title: `Kuis ${label}`, slug: `uji-kuis-${label}-${Date.now()}`, level: 'BEGINNER' })
        .expect(201)
    ).body.data.id as string;
    courseIds.push(courseId);

    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian uji' })
        .expect(201)
    ).body.data.id as string;

    const lessonId = (
      await asMaster('post', `/admin/modules/${moduleId}/lessons`)
        .send({ title: 'Ujian akhir', contentType: 'QUIZ' })
        .expect(201)
    ).body.data.id as string;

    const saved = await asMaster('put', `/admin/lessons/${lessonId}/quiz`).send(quiz).expect(200);

    await asMaster('post', `/admin/courses/${courseId}/publish`).expect(200);
    await asMaster('post', `/admin/courses/${courseId}/enrollments`)
      .send({ userIds: [student.userId] })
      .expect(200);

    return { courseId, lessonId, questions: saved.body.data.questions as SoalTersimpan[] };
  }

  const KUIS_DUA_SOAL = {
    passingScore: 100,
    showFeedback: true,
    questions: [
      {
        prompt: 'Ibu kota Indonesia?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'Jakarta', isCorrect: true },
          { text: 'Bandung', isCorrect: false },
        ],
      },
      {
        prompt: 'Mana saja bahasa pemrograman?',
        type: 'MULTIPLE_CHOICE',
        points: 3,
        options: [
          { text: 'TypeScript', isCorrect: true },
          { text: 'Python', isCorrect: true },
          { text: 'HTML', isCorrect: false },
        ],
      },
    ],
  };

  function jawabanBenar(questions: SoalTersimpan[]) {
    return questions.map((soal) => ({
      questionId: soal.id,
      selectedOptionIds: soal.options.filter((opsi) => opsi.isCorrect).map((opsi) => opsi.id),
    }));
  }

  it('menyimpan soal beserta kunci jawabannya untuk Master', async () => {
    const { lessonId, questions } = await siapkanKursusKuis('simpan', KUIS_DUA_SOAL);

    expect(questions).toHaveLength(2);
    expect(questions[0]!.options.filter((opsi) => opsi.isCorrect)).toHaveLength(1);

    const dibaca = await asMaster('get', `/admin/lessons/${lessonId}/quiz`).expect(200);
    expect(dibaca.body.data.totalPoints).toBe(4);
    expect(dibaca.body.data.questions[1].points).toBe(3);
  });

  it('tidak pernah mengirim kunci jawaban kepada pelajar sebelum dikirim', async () => {
    const { lessonId } = await siapkanKursusKuis('rahasia', KUIS_DUA_SOAL);

    const response = await asStudent('get', `/learn/lessons/${lessonId}/quiz`).expect(200);

    // Regresi yang dijaga: satu `include` polos di sisi pelajar sudah cukup
    // untuk membocorkan seluruh kunci jawaban ke peramban.
    expect(JSON.stringify(response.body)).not.toContain('isCorrect');
    for (const soal of response.body.data.questions) {
      for (const opsi of soal.options) {
        expect(Object.keys(opsi).sort()).toEqual(['id', 'text']);
      }
    }
  });

  it('menandai pelajaran selesai ketika kuis lulus', async () => {
    const { courseId, lessonId, questions } = await siapkanKursusKuis('lulus', KUIS_DUA_SOAL);

    const hasil = await asStudent('post', `/learn/lessons/${lessonId}/quiz/attempts`)
      .send({ answers: jawabanBenar(questions) })
      .expect(201);

    expect(hasil.body.data.scorePercent).toBe(100);
    expect(hasil.body.data.passed).toBe(true);
    expect(hasil.body.data.lessonCompleted).toBe(true);
    expect(hasil.body.data.review).toHaveLength(2);

    const kursus = await asStudent('get', `/learn/courses/${courseId}`).expect(200);
    expect(kursus.body.data.modules[0].lessons[0].status).toBe('COMPLETED');
    expect(kursus.body.data.progress.percent).toBe(100);
  });

  it('menilai jawaban ganda yang tidak lengkap sebagai salah dan tidak meluluskan', async () => {
    const { lessonId, questions } = await siapkanKursusKuis('separuh', KUIS_DUA_SOAL);

    const hasil = await asStudent('post', `/learn/lessons/${lessonId}/quiz/attempts`)
      .send({
        answers: [
          {
            questionId: questions[0]!.id,
            selectedOptionIds: [questions[0]!.options.find((o) => o.isCorrect)!.id],
          },
          {
            questionId: questions[1]!.id,
            selectedOptionIds: [questions[1]!.options.find((o) => o.isCorrect)!.id],
          },
        ],
      })
      .expect(201);

    expect(hasil.body.data.earnedPoints).toBe(1);
    expect(hasil.body.data.scorePercent).toBe(25);
    expect(hasil.body.data.passed).toBe(false);
    expect(hasil.body.data.lessonCompleted).toBe(false);
  });

  it('menegakkan batas percobaan di server', async () => {
    const { lessonId, questions } = await siapkanKursusKuis('batas', {
      ...KUIS_DUA_SOAL,
      maxAttempts: 1,
    });

    const salah = {
      answers: questions.map((soal) => ({
        questionId: soal.id,
        selectedOptionIds: [soal.options.find((opsi) => !opsi.isCorrect)!.id],
      })),
    };

    const pertama = await asStudent('post', `/learn/lessons/${lessonId}/quiz/attempts`)
      .send(salah)
      .expect(201);
    expect(pertama.body.data.attemptsLeft).toBe(0);

    const kedua = await asStudent('post', `/learn/lessons/${lessonId}/quiz/attempts`)
      .send(salah)
      .expect(409);
    expect(kedua.body.error.message).toContain('percobaan');
  });

  it('menolak pilihan jawaban milik soal lain', async () => {
    const { lessonId, questions } = await siapkanKursusKuis('silang', KUIS_DUA_SOAL);

    const response = await asStudent('post', `/learn/lessons/${lessonId}/quiz/attempts`)
      .send({
        answers: [
          { questionId: questions[0]!.id, selectedOptionIds: [questions[1]!.options[0]!.id] },
          { questionId: questions[1]!.id, selectedOptionIds: [questions[1]!.options[0]!.id] },
        ],
      })
      .expect(422);

    expect(response.body.error.fields.answers).toBeDefined();
  });

  it('menolak penyelesaian pelajaran kuis lewat endpoint biasa', async () => {
    const { lessonId } = await siapkanKursusKuis('pintas', KUIS_DUA_SOAL);

    const response = await asStudent('post', `/learn/lessons/${lessonId}/complete`)
      .send({})
      .expect(422);

    expect(response.body.error.fields.lesson).toBeDefined();
  });

  it('menolak kuis untuk permintaan tanpa sesi', async () => {
    const { lessonId } = await siapkanKursusKuis('tanpa-sesi', KUIS_DUA_SOAL);

    await request(h.server).get(`${prefix}/learn/lessons/${lessonId}/quiz`).expect(401);
    await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonId}/quiz/attempts`)
      .send({ answers: [{ questionId: lessonId, selectedOptionIds: [lessonId] }] })
      .expect(401);
  });

  it('menyembunyikan kuis pada kursus yang belum terbit', async () => {
    // Sejak kursus terbit terbuka untuk seluruh pengguna terautentikasi, batas
    // yang tersisa adalah status terbitnya. Kursus ini sengaja dibiarkan draf.
    const courseId = (
      await asMaster('post', '/admin/courses')
        .send({ title: 'Kuis draf', slug: `uji-kuis-draf-${Date.now()}`, level: 'BEGINNER' })
        .expect(201)
    ).body.data.id as string;
    courseIds.push(courseId);

    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian' })
        .expect(201)
    ).body.data.id as string;
    const lessonId = (
      await asMaster('post', `/admin/modules/${moduleId}/lessons`)
        .send({ title: 'Kuis draf', contentType: 'QUIZ' })
        .expect(201)
    ).body.data.id as string;
    await asMaster('put', `/admin/lessons/${lessonId}/quiz`).send(KUIS_DUA_SOAL).expect(200);

    await asStudent('get', `/learn/lessons/${lessonId}/quiz`).expect(404);
    await asStudent('post', `/learn/lessons/${lessonId}/quiz/attempts`)
      .send({ answers: [{ questionId: lessonId, selectedOptionIds: [lessonId] }] })
      .expect(404);
  });

  it('menolak kunci jawaban yang tidak dapat dinilai', async () => {
    const courseId = (
      await asMaster('post', '/admin/courses')
        .send({ title: 'Kuis cacat', slug: `uji-kuis-cacat-${Date.now()}`, level: 'BEGINNER' })
        .expect(201)
    ).body.data.id as string;
    courseIds.push(courseId);

    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian' })
        .expect(201)
    ).body.data.id as string;
    const lessonId = (
      await asMaster('post', `/admin/modules/${moduleId}/lessons`)
        .send({ title: 'Kuis', contentType: 'QUIZ' })
        .expect(201)
    ).body.data.id as string;

    const response = await asMaster('put', `/admin/lessons/${lessonId}/quiz`)
      .send({
        passingScore: 70,
        questions: [
          {
            prompt: 'Tanpa jawaban benar',
            type: 'SINGLE_CHOICE',
            options: [
              { text: 'A', isCorrect: false },
              { text: 'B', isCorrect: false },
            ],
          },
        ],
      })
      .expect(422);

    expect(response.body.error.fields.questions[0]).toContain('tepat satu jawaban benar');
  });

  it('menolak penerbitan kursus yang punya pelajaran kuis tanpa soal', async () => {
    const courseId = (
      await asMaster('post', '/admin/courses')
        .send({ title: 'Kuis kosong', slug: `uji-kuis-kosong-${Date.now()}`, level: 'BEGINNER' })
        .expect(201)
    ).body.data.id as string;
    courseIds.push(courseId);

    const moduleId = (
      await asMaster('post', `/admin/courses/${courseId}/modules`)
        .send({ title: 'Bagian' })
        .expect(201)
    ).body.data.id as string;
    await asMaster('post', `/admin/modules/${moduleId}/lessons`)
      .send({ title: 'Kuis belum bersoal', contentType: 'QUIZ' })
      .expect(201);

    const response = await asMaster('post', `/admin/courses/${courseId}/publish`).expect(422);
    expect(response.body.error.fields.course.join(' ')).toContain('belum memiliki soal');
  });

  it('menolak penghapusan soal yang sudah pernah dijawab', async () => {
    const { lessonId, questions } = await siapkanKursusKuis('riwayat', KUIS_DUA_SOAL);

    await asStudent('post', `/learn/lessons/${lessonId}/quiz/attempts`)
      .send({ answers: jawabanBenar(questions) })
      .expect(201);

    // Soal kedua dihilangkan dari payload; itulah bentuk permintaan hapus.
    const response = await asMaster('put', `/admin/lessons/${lessonId}/quiz`)
      .send({
        passingScore: 100,
        questions: [
          {
            id: questions[0]!.id,
            prompt: 'Ibu kota Indonesia? (diperbaiki)',
            type: 'SINGLE_CHOICE',
            options: [
              { text: 'Jakarta', isCorrect: true },
              { text: 'Bandung', isCorrect: false },
            ],
          },
        ],
      })
      .expect(409);

    expect(response.body.error.message).toContain('pernah dijawab');
  });

  it('tidak mengirim ulasan bila Master mematikan umpan balik', async () => {
    const { lessonId, questions } = await siapkanKursusKuis('tanpa-umpan', {
      ...KUIS_DUA_SOAL,
      showFeedback: false,
    });

    const hasil = await asStudent('post', `/learn/lessons/${lessonId}/quiz/attempts`)
      .send({ answers: jawabanBenar(questions) })
      .expect(201);

    expect(hasil.body.data.passed).toBe(true);
    expect(hasil.body.data.review).toBeNull();
  });
});
