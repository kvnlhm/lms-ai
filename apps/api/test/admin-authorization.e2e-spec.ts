import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
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
  { method: 'post', path: '/admin/users' },
  { method: 'patch', path: '/admin/users/00000000-0000-4000-8000-000000000000' },
  { method: 'post', path: '/admin/users/00000000-0000-4000-8000-000000000000/suspend' },
  { method: 'post', path: '/admin/users/00000000-0000-4000-8000-000000000000/activate' },
  { method: 'post', path: '/admin/users/00000000-0000-4000-8000-000000000000/reset-mfa' },
  { method: 'post', path: '/admin/users/00000000-0000-4000-8000-000000000000/password-reset-link' },
  { method: 'get', path: '/admin/courses' },
  { method: 'get', path: '/admin/analytics/dashboard' },
  { method: 'post', path: '/admin/courses' },
  // Urutan katalog: satu-satunya endpoint kursus yang tidak menyebut sebuah id,
  // dan karenanya paling mudah terlewat saat guard ditinjau.
  { method: 'put', path: '/admin/courses/order' },
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
  { method: 'get', path: '/admin/lessons/00000000-0000-4000-8000-000000000000/quiz' },
  { method: 'put', path: '/admin/lessons/00000000-0000-4000-8000-000000000000/quiz' },
  { method: 'delete', path: '/admin/lessons/00000000-0000-4000-8000-000000000000/quiz' },
  { method: 'post', path: '/admin/videos/upload-intents' },
  { method: 'put', path: '/admin/videos/00000000-0000-4000-8000-000000000000/content' },
  // Ketiganya menyentuh library Bunny milik akademi: membaca isinya, membuat
  // izin unggah ke sana, dan memindahkan aset ke video di dalamnya.
  { method: 'get', path: '/admin/videos/bunny/library' },
  { method: 'post', path: '/admin/videos/bunny/upload-tickets' },
  { method: 'put', path: '/admin/videos/00000000-0000-4000-8000-000000000000/source' },
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

  it('memberi Master analytics agregat tanpa data pribadi Pelajar', async () => {
    const response = await request(h.server)
      .get(`${prefix}/admin/analytics/dashboard?days=30`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        periodDays: 30,
        summary: expect.objectContaining({
          activeLearners: expect.any(Number),
          lessonOpens: expect.any(Number),
          lessonCompletions: expect.any(Number),
          learningMinutes: expect.any(Number),
        }),
        courses: expect.any(Array),
        daily: expect.any(Array),
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain(STUDENT.email);
  });

  it('membuat Pelajar lewat undangan sekali pakai dan dapat menetapkan password', async () => {
    const email = `undangan-${randomUUID()}@example.com`;
    const created = await request(h.server)
      .post(`${prefix}/admin/users`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({
        fullName: 'Pelajar Undangan',
        email,
        phone: null,
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);

    expect(created.body.data.invitationToken).toEqual(expect.any(String));
    expect(JSON.stringify(created.body)).not.toContain('passwordHash');

    await request(h.server)
      .post(`${prefix}/auth/accept-invitation`)
      .send({
        token: created.body.data.invitationToken,
        password: 'Password#Undangan123',
        passwordConfirmation: 'Password#Undangan123',
      })
      .expect(200);

    await request(h.server)
      .post(`${prefix}/auth/accept-invitation`)
      .send({
        token: created.body.data.invitationToken,
        password: 'Password#Undangan123',
        passwordConfirmation: 'Password#Undangan123',
      })
      .expect(422);

    await login(h.server, email, 'Password#Undangan123');

    const reset = await request(h.server)
      .post(`${prefix}/admin/users/${created.body.data.id}/password-reset-link`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(200);

    await request(h.server)
      .post(`${prefix}/auth/reset-password`)
      .send({
        token: reset.body.data.token,
        password: 'Password#Baru456789',
        passwordConfirmation: 'Password#Baru456789',
      })
      .expect(200);

    await request(h.server)
      .post(`${prefix}/auth/login`)
      .send({ email, password: 'Password#Undangan123' })
      .expect(401);
    await login(h.server, email, 'Password#Baru456789');

    await request(h.server)
      .post(`${prefix}/auth/reset-password`)
      .send({
        token: reset.body.data.token,
        password: 'Password#Lain456789',
        passwordConfirmation: 'Password#Lain456789',
      })
      .expect(422);

    const prisma = new PrismaClient();
    try {
      await prisma.user.delete({ where: { email } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('tidak memberi Pelajar permission apa pun pada /auth/me', async () => {
    const response = await request(h.server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', student.cookie)
      .expect(200);

    expect(response.body.data.permissions).toEqual([]);
  });

  it('memberi Master permission courses.manage, enrollments.manage, dan analytics.read', async () => {
    const response = await request(h.server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining(['courses.manage', 'enrollments.manage', 'analytics.read']),
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
