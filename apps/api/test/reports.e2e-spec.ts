import request from 'supertest';
import { REPORT_KEYS } from '../src/modules/reports/application/report.service';
import { login, prefix, startHarness, type Harness, type Session } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Ekspor laporan CSV', () => {
  let h: Harness;
  let master: Session;

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
  });

  afterAll(async () => {
    await h.close();
  });

  it('menyebut seluruh laporan pada katalog', async () => {
    const response = await request(h.server)
      .get(`${prefix}/admin/reports`)
      .set('Cookie', master.cookie)
      .expect(200);

    // PRD 9 menyebut sembilan laporan; katalog harus memuat semuanya.
    expect(response.body.data.reports).toHaveLength(9);
    expect(response.body.data.reports.map((r: { key: string }) => r.key).sort()).toEqual(
      [...REPORT_KEYS].sort(),
    );
  });

  describe.each(REPORT_KEYS)('laporan %s', (key) => {
    it('dapat diunduh sebagai CSV', async () => {
      const response = await request(h.server)
        .get(`${prefix}/admin/reports/${key}.csv`)
        .set('Cookie', master.cookie)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain(`attachment; filename="${key}-`);
      // Laporan memuat data pribadi; tidak boleh mengendap di cache perantara.
      expect(response.headers['cache-control']).toBe('no-store');

      // Selalu ada baris header, walau datanya kosong. Berkas benar-benar
      // kosong tidak dapat dibedakan dari ekspor yang gagal.
      const lines = response.text.trim().split('\r\n');
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines[0]!.length).toBeGreaterThan(0);
    });
  });

  it('tidak membungkus CSV ke dalam amplop JSON', async () => {
    const response = await request(h.server)
      .get(`${prefix}/admin/reports/users.csv`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.text).not.toContain('"data"');
    expect(response.text.startsWith('﻿')).toBe(true);
  });

  it('menolak pelajar', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await request(h.server)
      .get(`${prefix}/admin/reports/users.csv`)
      .set('Cookie', student.cookie)
      .expect(403);
    await request(h.server)
      .get(`${prefix}/admin/reports`)
      .set('Cookie', student.cookie)
      .expect(403);
  });

  it('menolak permintaan tanpa sesi', async () => {
    await request(h.server).get(`${prefix}/admin/reports/users.csv`).expect(401);
  });

  it('menolak kunci laporan yang tidak dikenal', async () => {
    await request(h.server)
      .get(`${prefix}/admin/reports/rahasia.csv`)
      .set('Cookie', master.cookie)
      .expect(422);
  });

  it('menolak penyaring yang bentuknya salah', async () => {
    await request(h.server)
      .get(`${prefix}/admin/reports/users.csv?courseId=bukan-uuid`)
      .set('Cookie', master.cookie)
      .expect(422);

    await request(h.server)
      .get(`${prefix}/admin/reports/users.csv?from=kemarin`)
      .set('Cookie', master.cookie)
      .expect(422);
  });

  it('mencatat ekspor pada audit log tanpa menyalin isinya', async () => {
    await h.prisma.auditLog.deleteMany({ where: { action: 'report.exported' } });

    await request(h.server)
      .get(`${prefix}/admin/reports/users.csv`)
      .set('Cookie', master.cookie)
      .expect(200);

    const entry = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'report.exported' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry.actorUserId).toBe(master.userId);

    const after = entry.afterData as { report: string; rowCount: number };
    expect(after.report).toBe('users');
    expect(typeof after.rowCount).toBe('number');
    // Yang dicatat adalah bahwa ekspor terjadi, bukan datanya. Audit log bukan
    // tempat menyalin alamat email seluruh pelajar.
    expect(JSON.stringify(entry.afterData)).not.toContain(MASTER.email);
  });

  it('menghormati penyaring kursus pada laporan enrollment', async () => {
    const course = await h.prisma.course.findFirstOrThrow({ select: { id: true } });

    const semua = await request(h.server)
      .get(`${prefix}/admin/reports/enrollments.csv`)
      .set('Cookie', master.cookie)
      .expect(200);

    const tersaring = await request(h.server)
      .get(`${prefix}/admin/reports/enrollments.csv?courseId=${course.id}`)
      .set('Cookie', master.cookie)
      .expect(200);

    const baris = (csv: string) => csv.trim().split('\r\n').length;
    expect(baris(tersaring.text)).toBeLessThanOrEqual(baris(semua.text));
  });

  it('menetralkan nama yang berbentuk rumus sebelum masuk berkas', async () => {
    const jahat = await h.prisma.user.create({
      data: {
        email: `rumus-${Date.now()}@akademionline.id`,
        passwordHash: 'x',
        fullName: '=HYPERLINK("http://jahat.test","Klik")',
      },
      select: { id: true },
    });

    try {
      const response = await request(h.server)
        .get(`${prefix}/admin/reports/users.csv`)
        .set('Cookie', master.cookie)
        .expect(200);

      // Nama pengguna adalah teks yang ditulis pengguna. Tanpa penetralan,
      // Excel menjalankannya begitu Master membuka berkasnya.
      expect(response.text).toContain('\'=HYPERLINK');
      expect(response.text).not.toMatch(/(^|,)"?=HYPERLINK/m);
    } finally {
      await h.prisma.user.delete({ where: { id: jahat.id } });
    }
  });

  it('tidak pernah menyertakan hash password', async () => {
    const response = await request(h.server)
      .get(`${prefix}/admin/reports/users.csv`)
      .set('Cookie', master.cookie)
      .expect(200);

    expect(response.text).not.toContain('$argon2');
    expect(response.text.toLowerCase()).not.toContain('password');
  });
});
