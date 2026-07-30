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
