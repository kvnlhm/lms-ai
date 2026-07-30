import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };
const COURSE_SLUG = 'video-editing-mastery';

describe('Penyelesaian pelajaran', () => {
  let h: Harness;
  let session: Awaited<ReturnType<typeof login>>;
  let courseId: string;
  let lessonIds: string[];

  beforeAll(async () => {
    h = await startHarness();
    session = await login(h.server, STUDENT.email, STUDENT.password);

    const course = await h.prisma.course.findUniqueOrThrow({
      where: { slug: COURSE_SLUG },
      select: { id: true },
    });
    courseId = course.id;

    const lessons = await h.prisma.lesson.findMany({
      where: { module: { courseId } },
      orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true },
    });
    lessonIds = lessons.map((lesson) => lesson.id);
  });

  afterAll(async () => {
    await h.close();
  });

  /** Setiap test mulai dari progres kosong agar hasilnya tidak saling bergantung. */
  beforeEach(async () => {
    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: session.userId, courseId },
    });
    await h.prisma.lessonProgress.deleteMany({ where: { enrollmentId: enrollment.id } });
    await h.prisma.courseProgress.updateMany({
      where: { enrollmentId: enrollment.id },
      data: { progressPercent: 0, requiredLessonsComplete: 0, completedAt: null },
    });
    await h.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'ACTIVE', completedAt: null },
    });
    await h.prisma.outboxMessage.deleteMany({ where: { aggregateId: enrollment.id } });
    await h.prisma.learningEvent.deleteMany({ where: { userId: session.userId } });
  });

  function complete(lessonId: string, idempotencyKey?: string) {
    const req = request(h.server)
      .post(`${prefix}/learn/lessons/${lessonId}/complete`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken);
    if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey);
    return req.send({ completionEvidence: { activeSeconds: 120 } });
  }

  it('menaikkan progres dan menunjuk pelajaran berikutnya', async () => {
    const response = await complete(lessonIds[0]!).expect(200);

    expect(response.body.data.lessonStatus).toBe('COMPLETED');
    expect(response.body.data.courseProgress).toBeCloseTo((1 / lessonIds.length) * 100, 1);
    expect(response.body.data.nextLessonId).toBe(lessonIds[1]);
    expect(response.body.data.courseStatus).toBe('ACTIVE');

    const continuation = await request(h.server)
      .get(`${prefix}/me/continue-learning`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(continuation.body.data.lesson.id).toBe(lessonIds[1]);
  });

  it('mengembalikan pelajaran aktif untuk dilanjutkan', async () => {
    await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonIds[0]}/open`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({})
      .expect(200);

    const response = await request(h.server)
      .get(`${prefix}/me/continue-learning`)
      .set('Cookie', session.cookie)
      .expect(200);

    expect(response.body.data).toMatchObject({
      course: { id: courseId },
      lesson: { id: lessonIds[0] },
      progressPercent: 0,
    });
  });

  it('menampilkan histori milik sendiri dengan cursor dan menyembunyikan milik pengguna lain', async () => {
    const master = await h.prisma.user.findUniqueOrThrow({
      where: { email: 'master@akademionline.id' },
      select: { id: true },
    });
    const ownFirst = await h.prisma.learningEvent.create({
      data: {
        eventUuid: randomUUID(),
        eventName: 'learning.lesson_opened',
        userId: session.userId,
        courseId,
        lessonId: lessonIds[0],
        occurredAt: new Date('2026-07-30T01:00:00Z'),
      },
    });
    const ownSecond = await h.prisma.learningEvent.create({
      data: {
        eventUuid: randomUUID(),
        eventName: 'learning.lesson_completed',
        userId: session.userId,
        courseId,
        lessonId: lessonIds[1],
        occurredAt: new Date('2026-07-30T02:00:00Z'),
        durationSeconds: 120,
        metadata: { courseProgressPercent: 20 },
      },
    });
    await h.prisma.learningEvent.create({
      data: {
        eventUuid: randomUUID(),
        eventName: 'learning.lesson_opened',
        userId: master.id,
        courseId,
        lessonId: lessonIds[2],
        occurredAt: new Date('2026-07-30T03:00:00Z'),
      },
    });

    const firstPage = await request(h.server)
      .get(`${prefix}/me/learning-history?limit=1`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(firstPage.body.data.items).toHaveLength(1);
    expect(firstPage.body.data.items[0]).toMatchObject({
      id: ownSecond.id.toString(),
      activityType: 'LESSON_COMPLETED',
      lessonId: lessonIds[1],
      progressAfter: 20,
    });
    expect(firstPage.body.data.nextCursor).toBe(ownSecond.id.toString());

    const secondPage = await request(h.server)
      .get(`${prefix}/me/learning-history?limit=1&cursor=${firstPage.body.data.nextCursor}`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(secondPage.body.data.items[0].id).toBe(ownFirst.id.toString());
    expect(JSON.stringify(secondPage.body.data)).not.toContain(master.id);
  });

  it('menulis event ke outbox dalam transaksi yang sama', async () => {
    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: session.userId, courseId },
    });

    await complete(lessonIds[0]!).expect(200);

    const events = await h.prisma.outboxMessage.findMany({
      where: { aggregateId: enrollment.id, eventType: 'learning.lesson_completed' },
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.publishedAt).toBeNull();
    expect(events[0]!.payload).toMatchObject({ lessonId: lessonIds[0], userId: session.userId });
  });

  it('tidak menduplikasi event ketika pelajaran diselesaikan dua kali', async () => {
    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: session.userId, courseId },
    });

    await complete(lessonIds[0]!).expect(200);
    // Kunci idempotensi berbeda: server tidak boleh mengandalkan kunci saja,
    // melainkan pada perubahan status yang sesungguhnya.
    const second = await complete(lessonIds[0]!).expect(200);

    expect(second.body.data.lessonStatus).toBe('COMPLETED');

    const events = await h.prisma.outboxMessage.findMany({
      where: { aggregateId: enrollment.id, eventType: 'learning.lesson_completed' },
    });
    expect(events).toHaveLength(1);

    const progress = await h.prisma.courseProgress.findUniqueOrThrow({
      where: { enrollmentId: enrollment.id },
    });
    expect(progress.requiredLessonsComplete).toBe(1);
  });

  it('mengembalikan respons yang sama untuk Idempotency-Key yang diulang', async () => {
    const key = randomUUID();

    const first = await complete(lessonIds[0]!, key).expect(200);
    const replay = await complete(lessonIds[0]!, key).expect(200);

    expect(replay.body.data).toEqual(first.body.data);
  });

  it('menolak Idempotency-Key yang sama dengan isi permintaan berbeda', async () => {
    const key = randomUUID();

    await complete(lessonIds[0]!, key).expect(200);

    const conflict = await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonIds[0]}/complete`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .set('Idempotency-Key', key)
      .send({ completionEvidence: { activeSeconds: 999 } })
      .expect(409);

    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('menolak Idempotency-Key yang bukan UUID', async () => {
    const response = await complete(lessonIds[0]!, 'bukan-uuid').expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('menandai kursus selesai setelah seluruh pelajaran wajib tuntas', async () => {
    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: session.userId, courseId },
    });

    for (const lessonId of lessonIds) {
      await complete(lessonId).expect(200);
    }

    const last = await h.prisma.courseProgress.findUniqueOrThrow({
      where: { enrollmentId: enrollment.id },
    });
    expect(Number(last.progressPercent)).toBe(100);
    expect(last.completedAt).not.toBeNull();

    const updated = await h.prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(updated.status).toBe('COMPLETED');

    const courseCompleted = await h.prisma.outboxMessage.findMany({
      where: { aggregateId: enrollment.id, eventType: 'learning.course_completed' },
    });
    // Tepat satu, meskipun pelajaran terakhir dapat diselesaikan berulang.
    expect(courseCompleted).toHaveLength(1);
  });

  it('tidak melampaui 100 persen ketika pelajaran terakhir diulang', async () => {
    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: session.userId, courseId },
    });

    for (const lessonId of lessonIds) await complete(lessonId).expect(200);
    const repeat = await complete(lessonIds[lessonIds.length - 1]!).expect(200);

    expect(repeat.body.data.courseProgress).toBe(100);

    const events = await h.prisma.outboxMessage.findMany({
      where: { aggregateId: enrollment.id, eventType: 'learning.course_completed' },
    });
    expect(events).toHaveLength(1);
  });

  it('menahan dua permintaan bersamaan agar progres tidak dihitung ganda', async () => {
    const enrollment = await h.prisma.enrollment.findFirstOrThrow({
      where: { userId: session.userId, courseId },
    });

    const [a, b] = await Promise.all([complete(lessonIds[0]!), complete(lessonIds[0]!)]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const progress = await h.prisma.courseProgress.findUniqueOrThrow({
      where: { enrollmentId: enrollment.id },
    });
    expect(progress.requiredLessonsComplete).toBe(1);

    const events = await h.prisma.outboxMessage.findMany({
      where: { aggregateId: enrollment.id, eventType: 'learning.lesson_completed' },
    });
    expect(events).toHaveLength(1);
  });
});
