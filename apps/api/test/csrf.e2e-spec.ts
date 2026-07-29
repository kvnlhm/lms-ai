import request from 'supertest';
import { firstLessonOf, login, prefix, startHarness, type Harness } from './support/harness';

const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Perlindungan CSRF', () => {
  let h: Harness;
  let lessonId: string;

  beforeAll(async () => {
    h = await startHarness();
    lessonId = await firstLessonOf(h.prisma, 'video-editing-mastery');
  });

  afterAll(async () => {
    await h.close();
  });

  it('menolak mutation tanpa header CSRF meskipun cookie session valid', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);

    const response = await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonId}/open`)
      .set('Cookie', session.cookie)
      .send({})
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('menolak mutation dengan token CSRF milik session lain', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const other = await login(h.server, 'samuel@akademionline.id', 'Pelajar#Lokal12345');

    await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonId}/open`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', other.csrfToken)
      .send({})
      .expect(403);
  });

  it('mengizinkan mutation dengan token CSRF yang cocok', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);

    await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonId}/open`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({})
      .expect(200);
  });

  it('tidak meminta token CSRF untuk pembacaan', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);

    await request(h.server)
      .get(`${prefix}/me/enrollments`)
      .set('Cookie', session.cookie)
      .expect(200);
  });
});
