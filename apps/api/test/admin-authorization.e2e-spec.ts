import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };
const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };

/**
 * Setiap endpoint administratif diuji terhadap tiga keadaan: tanpa session,
 * sebagai Pelajar, dan sebagai Master. Menguji satu endpoint saja tidak cukup —
 * permission dipasang per controller dan mudah terlewat pada endpoint baru.
 */
const ADMIN_ENDPOINTS: Array<{ method: 'get' | 'post' | 'patch' | 'put' | 'delete'; path: string }> = [
  { method: 'get', path: '/admin/users' },
  { method: 'get', path: '/admin/courses' },
  { method: 'post', path: '/admin/courses' },
  { method: 'get', path: '/admin/courses/00000000-0000-4000-8000-000000000000' },
  { method: 'patch', path: '/admin/courses/00000000-0000-4000-8000-000000000000' },
  { method: 'post', path: '/admin/courses/00000000-0000-4000-8000-000000000000/publish' },
  { method: 'post', path: '/admin/courses/00000000-0000-4000-8000-000000000000/archive' },
  { method: 'delete', path: '/admin/courses/00000000-0000-4000-8000-000000000000' },
  { method: 'post', path: '/admin/courses/00000000-0000-4000-8000-000000000000/modules' },
  { method: 'patch', path: '/admin/modules/00000000-0000-4000-8000-000000000000' },
  { method: 'delete', path: '/admin/modules/00000000-0000-4000-8000-000000000000' },
  { method: 'post', path: '/admin/modules/00000000-0000-4000-8000-000000000000/lessons' },
  { method: 'patch', path: '/admin/lessons/00000000-0000-4000-8000-000000000000' },
  { method: 'delete', path: '/admin/lessons/00000000-0000-4000-8000-000000000000' },
  { method: 'get', path: '/admin/courses/00000000-0000-4000-8000-000000000000/enrollments' },
  { method: 'post', path: '/admin/courses/00000000-0000-4000-8000-000000000000/enrollments' },
  { method: 'post', path: '/admin/enrollments/00000000-0000-4000-8000-000000000000/remove' },
  { method: 'post', path: '/admin/enrollments/00000000-0000-4000-8000-000000000000/reactivate' },
  { method: 'post', path: '/admin/videos/upload-intents' },
  { method: 'put', path: '/admin/videos/00000000-0000-4000-8000-000000000000/content' },
];

describe('Otorisasi endpoint Master', () => {
  let h: Harness;
  let student: Awaited<ReturnType<typeof login>>;
  let master: Awaited<ReturnType<typeof login>>;

  beforeAll(async () => {
    h = await startHarness();
    student = await login(h.server, STUDENT.email, STUDENT.password);
    master = await login(h.server, MASTER.email, MASTER.password);
  });

  afterAll(async () => {
    await h.close();
  });

  it.each(ADMIN_ENDPOINTS)('menolak $method $path tanpa session', async ({ method, path }) => {
    const response = await request(h.server)[method](`${prefix}${path}`).send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it.each(ADMIN_ENDPOINTS)('menolak $method $path untuk Pelajar', async ({ method, path }) => {
    const response = await request(h.server)
      [method](`${prefix}${path}`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({});

    // 403 PERMISSION_DENIED, bukan 404 atau 422: guard permission harus
    // menolak sebelum handler sempat menyentuh data atau memvalidasi payload.
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('memberi Master akses ke daftar kursus administratif', async () => {
    const response = await request(h.server)
      .get(`${prefix}/admin/courses`)
      .set('Cookie', master.cookie)
      .expect(200);

    const slugs = (response.body.data as Array<{ slug: string; status: string }>).map((c) => c.slug);
    // Berbeda dari katalog publik, daftar ini memuat kursus draf.
    expect(slugs).toContain('generative-ai-mastery');
  });

  it('memberi Master akses mencari Pelajar tanpa membocorkan password', async () => {
    const response = await request(h.server)
      .get(`${prefix}/admin/users?search=pelajar&role=STUDENT`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: STUDENT.email, role: 'STUDENT', status: 'ACTIVE' }),
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('tidak memberi Pelajar permission apa pun pada /auth/me', async () => {
    const response = await request(h.server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', student.cookie)
      .expect(200);

    expect(response.body.data.permissions).toEqual([]);
  });

  it('memberi Master permission courses.manage dan enrollments.manage', async () => {
    const response = await request(h.server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining(['courses.manage', 'enrollments.manage']),
    );
  });

  it('tetap menuntut token CSRF dari Master', async () => {
    await request(h.server)
      .post(`${prefix}/admin/courses`)
      .set('Cookie', master.cookie)
      .send({ title: 'Tanpa CSRF', slug: 'tanpa-csrf', level: 'BEGINNER' })
      .expect(403);
  });
});
