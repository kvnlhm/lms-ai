import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Autentikasi dan session', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('menolak endpoint terproteksi tanpa session', async () => {
    const response = await request(h.server).get(`${prefix}/auth/me`).expect(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(response.body.error.requestId).toEqual(expect.any(String));
  });

  it('menolak kredensial salah tanpa mengungkap keberadaan akun', async () => {
    const unknownEmail = await request(h.server)
      .post(`${prefix}/auth/login`)
      .send({ email: 'tidak-ada@akademionline.id', password: 'SalahSekali12345' })
      .expect(401);

    const wrongPassword = await request(h.server)
      .post(`${prefix}/auth/login`)
      .send({ email: STUDENT.email, password: 'SalahSekali12345' })
      .expect(401);

    // Kedua kasus harus tidak dapat dibedakan dari sisi klien.
    expect(unknownEmail.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('menolak payload yang tidak valid dengan 422 dan detail field', async () => {
    const response = await request(h.server)
      .post(`${prefix}/auth/login`)
      .send({ email: 'bukan-email', password: 'pendek' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(response.body.error.fields)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('memasang cookie session HttpOnly dan cookie CSRF yang dapat dibaca', async () => {
    const response = await request(h.server)
      .post(`${prefix}/auth/login`)
      .send(STUDENT)
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const session = cookies.find((entry) => entry.startsWith('lms_session='));
    const csrf = cookies.find((entry) => entry.startsWith('lms_csrf='));

    expect(session).toContain('HttpOnly');
    expect(csrf).toBeDefined();
    expect(csrf).not.toContain('HttpOnly');

    // Identifier session tidak boleh muncul di badan respons.
    expect(JSON.stringify(response.body)).not.toContain('lms_session');
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('memberi akses ke /auth/me setelah masuk', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);

    const response = await request(h.server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', session.cookie)
      .expect(200);

    expect(response.body.data.email).toBe(STUDENT.email);
    expect(response.body.data.role).toBe('STUDENT');
    // Pelajar tidak memegang permission administratif apa pun.
    expect(response.body.data.permissions).toEqual([]);
    expect(response.body.data).not.toHaveProperty('passwordHash');
  });

  it('menampilkan dan memperbarui preferensi notifikasi milik sendiri', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    await h.prisma.notificationPreference.deleteMany({ where: { userId: session.userId } });

    const defaults = await request(h.server)
      .get(`${prefix}/me/notifications/preferences`)
      .set('Cookie', session.cookie)
      .expect(200);

    expect(defaults.body.data).toEqual({
      announcementsEnabled: true,
      courseUpdatesEnabled: true,
      learningRemindersEnabled: true,
    });

    const updated = await request(h.server)
      .put(`${prefix}/me/notifications/preferences`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        announcementsEnabled: true,
        courseUpdatesEnabled: false,
        learningRemindersEnabled: false,
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      announcementsEnabled: true,
      courseUpdatesEnabled: false,
      learningRemindersEnabled: false,
    });

    await request(h.server)
      .put(`${prefix}/me/notifications/preferences`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ announcementsEnabled: 'yes' })
      .expect(422);

    await h.prisma.notificationPreference.deleteMany({ where: { userId: session.userId } });
  });

  it('memperbarui profil sendiri tanpa dapat mengubah role atau status', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const before = await request(h.server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', session.cookie)
      .expect(200);

    const updated = await request(h.server)
      .patch(`${prefix}/auth/me`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        fullName: 'Pelajar Uji Profil',
        phone: '+628123456789',
        bio: 'Bio pengujian profil.',
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      fullName: 'Pelajar Uji Profil',
      phone: '+628123456789',
      bio: 'Bio pengujian profil.',
      role: 'STUDENT',
      status: 'ACTIVE',
    });

    await request(h.server)
      .patch(`${prefix}/auth/me`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ role: 'MASTER' })
      .expect(422);

    await request(h.server)
      .patch(`${prefix}/auth/me`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        fullName: before.body.data.fullName,
        phone: before.body.data.phone,
        bio: before.body.data.bio,
      })
      .expect(200);
  });

  it('menandai session perangkat saat ini', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const response = await request(h.server)
      .get(`${prefix}/auth/sessions`)
      .set('Cookie', session.cookie)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), isCurrent: true }),
      ]),
    );
  });

  it('mengganti password dengan password lama dan mencabut seluruh session', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const temporaryPassword = 'Pelajar#PasswordBaru12345';

    await request(h.server)
      .patch(`${prefix}/auth/me/password`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        currentPassword: STUDENT.password,
        newPassword: temporaryPassword,
        newPasswordConfirmation: temporaryPassword,
      })
      .expect(200);

    await request(h.server).get(`${prefix}/auth/me`).set('Cookie', session.cookie).expect(401);
    await request(h.server).post(`${prefix}/auth/login`).send(STUDENT).expect(401);

    const replacement = await login(h.server, STUDENT.email, temporaryPassword);
    await request(h.server)
      .patch(`${prefix}/auth/me/password`)
      .set('Cookie', replacement.cookie)
      .set('X-CSRF-Token', replacement.csrfToken)
      .send({
        currentPassword: temporaryPassword,
        newPassword: STUDENT.password,
        newPasswordConfirmation: STUDENT.password,
      })
      .expect(200);
  });

  it('mengunggah, menyajikan, dan menghapus foto profil tervalidasi', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('avatar-test-content'),
    ]);

    const uploaded = await request(h.server)
      .put(`${prefix}/auth/me/avatar`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .set('Content-Type', 'image/png')
      .send(png)
      .expect(200);

    expect(uploaded.body.data.avatarUrl).toMatch(/^\/api\/v1\/auth\/avatars\/.+\.png$/);
    const avatarPath = uploaded.body.data.avatarUrl as string;
    const image = await request(h.server).get(avatarPath).expect(200);
    expect(image.headers['content-type']).toMatch(/^image\/png/);
    expect(image.body).toEqual(png);

    await request(h.server)
      .put(`${prefix}/auth/me/avatar`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('bukan-png'))
      .expect(422);

    await request(h.server)
      .delete(`${prefix}/auth/me/avatar`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .expect(204);

    await request(h.server).get(avatarPath).expect(404);
  });

  it('mencabut session di sisi server saat keluar', async () => {
    const session = await login(h.server, STUDENT.email, STUDENT.password);

    await request(h.server)
      .post(`${prefix}/auth/logout`)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .expect(204);

    // Cookie yang sama tidak lagi berlaku karena state-nya sudah hilang di Redis.
    await request(h.server).get(`${prefix}/auth/me`).set('Cookie', session.cookie).expect(401);
  });
});
