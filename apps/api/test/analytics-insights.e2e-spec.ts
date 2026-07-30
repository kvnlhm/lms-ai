import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

/**
 * Nilai metriknya bergantung pada data seed, jadi yang diuji di sini adalah
 * bahwa seluruh SQL mentahnya benar-benar berjalan dan bentuk responsnya utuh.
 * Kekeliruan nama kolom pada query mentah hanya muncul saat dieksekusi.
 */
describe('Insight kebiasaan belajar', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('menjalankan seluruh query insight dan mengembalikan bentuk yang lengkap', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);

    const response = await request(h.server)
      .get(`${prefix}/admin/analytics/insights?days=30`)
      .set('Cookie', master.cookie)
      .expect(200);

    const data = response.body.data as Record<string, Record<string, unknown>>;

    expect(data.periodDays).toBe(30);
    expect(data.habit).toEqual(
      expect.objectContaining({
        dailyActiveLearners: expect.any(Number),
        weeklyActiveLearners: expect.any(Number),
        monthlyActiveLearners: expect.any(Number),
        averageStudyDaysPerLearner: expect.any(Number),
        averageMinutesPerStudyDay: expect.any(Number),
        returningLearners: expect.any(Number),
      }),
    );
    expect(data.retention).toEqual({
      sevenDay: expect.any(Number),
      thirtyDay: expect.any(Number),
    });
    expect(data.forum).toEqual(
      expect.objectContaining({
        participationRate: expect.any(Number),
        contributors: expect.any(Number),
        topics: expect.any(Number),
        replies: expect.any(Number),
        topContributors: expect.any(Array),
      }),
    );
    expect(data.risk.counts).toEqual({
      LOW: expect.any(Number),
      MEDIUM: expect.any(Number),
      HIGH: expect.any(Number),
    });
    expect(Array.isArray(data.risk.learners)).toBe(true);
  });

  it('memberi setiap pelajar berisiko sebuah alasan yang dapat dibaca', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);

    const response = await request(h.server)
      .get(`${prefix}/admin/analytics/insights?days=30`)
      .set('Cookie', master.cookie)
      .expect(200);

    const learners = response.body.data.risk.learners as Array<{
      level: string;
      reason: string;
    }>;
    for (const learner of learners) {
      // Daftar ini hanya memuat yang perlu ditindak.
      expect(['MEDIUM', 'HIGH']).toContain(learner.level);
      expect(learner.reason.length).toBeGreaterThan(10);
    }
  });

  it('menolak pelajar membaca insight', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);

    await request(h.server)
      .get(`${prefix}/admin/analytics/insights`)
      .set('Cookie', student.cookie)
      .expect(403);
  });

  it('menolak rentang hari di luar batas', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);

    await request(h.server)
      .get(`${prefix}/admin/analytics/insights?days=365`)
      .set('Cookie', master.cookie)
      .expect(422);
  });
});
