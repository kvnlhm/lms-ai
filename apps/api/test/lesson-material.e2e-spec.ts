import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { firstLessonOf, login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };
const STUDENT_LAIN = { email: 'samuel@akademionline.id', password: 'Pelajar#Lokal12345' };

/** PDF terkecil yang tetap sah: penanda `%PDF-` di awal sudah cukup. */
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const BUKAN_PDF = Buffer.from('PK ini sebenarnya zip');

describe('Materi pelajaran terlindungi', () => {
  let h: Harness;
  let lessonId: string;
  const storage = process.env.LESSON_MATERIAL_STORAGE_PATH ?? '/tmp/lms-ci-materials';

  beforeAll(async () => {
    process.env.LESSON_MATERIAL_STORAGE_PATH = storage;
    h = await startHarness();
    lessonId = await firstLessonOf(h.prisma, 'video-editing-mastery');
  });

  afterAll(async () => {
    const sisa = await h.prisma.lessonMaterial.findMany({ select: { objectKey: true } });
    await h.prisma.lessonMaterial.deleteMany({});
    await Promise.all(sisa.map((row) => rm(join(storage, row.objectKey), { force: true })));
    await h.close();
  });

  async function unggah(cookie: string, csrf: string, isi: Buffer, harapan: number) {
    return request(h.server)
      .put(`${prefix}/admin/lessons/${lessonId}/material`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'panduan.pdf')
      .send(isi)
      .expect(harapan);
  }

  it('menolak Pelajar mengunggah materi', async () => {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    await unggah(student.cookie, student.csrfToken, PDF, 403);
  });

  it('menolak berkas yang bukan PDF meski namanya .pdf', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    // Ekstensi dan Content-Type sama-sama dapat dipalsukan; yang menentukan
    // adalah byte awal berkasnya.
    const ditolak = await unggah(master.cookie, master.csrfToken, BUKAN_PDF, 422);
    expect(JSON.stringify(ditolak.body)).toContain('PDF');
    expect(await h.prisma.lessonMaterial.count({ where: { lessonId } })).toBe(0);
  });

  it('menerima PDF, lalu menyebutkannya pada detail pelajaran', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const hasil = await unggah(master.cookie, master.csrfToken, PDF, 200);
    expect(hasil.body.data.originalName).toBe('panduan.pdf');
    expect(hasil.body.data.mimeType).toBe('application/pdf');
    expect(hasil.body.data.sizeBytes).toBe(String(PDF.length));

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const pelajaran = await request(h.server)
      .get(`${prefix}/learn/lessons/${lessonId}`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(pelajaran.body.data.hasMaterial).toBe(true);
    // Kunci berkasnya tidak pernah ikut terkirim: mengetahui id pelajaran saja
    // tidak boleh menjadi jalan pintas menuju isinya.
    expect(JSON.stringify(pelajaran.body.data)).not.toContain('.pdf');
  });

  it('menyajikan berkas lewat reverse proxy hanya bagi yang berhak', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    await unggah(master.cookie, master.csrfToken, PDF, 200);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const berhak = await request(h.server)
      .get(`${prefix}/learn/lessons/${lessonId}/material`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(berhak.headers['x-accel-redirect']).toMatch(/^\/protected-materials\/[0-9a-f-]+\.pdf$/);
    expect(berhak.headers['cache-control']).toContain('no-store');

    // Tanpa sesi sama sekali.
    await request(h.server).get(`${prefix}/learn/lessons/${lessonId}/material`).expect(401);

    // Haknya diperiksa lewat `assertLessonAccess`, aturan yang sama persis
    // dengan video self-hosted. Pada kursus terbit, akun aktif mana pun
    // memang memperoleh enrollment otomatis — itu keputusan produk yang sudah
    // ada, bukan kebocoran materi. Yang dijaga di sini: pelajaran pada kursus
    // yang belum terbit tetap tertutup.
    const draf = await h.prisma.lesson.findFirst({
      where: { module: { course: { status: { not: 'PUBLISHED' } } } },
      select: { id: true },
    });
    if (draf) {
      const asing = await login(h.server, STUDENT_LAIN.email, STUDENT_LAIN.password);
      const ditolak = await request(h.server)
        .get(`${prefix}/learn/lessons/${draf.id}/material`)
        .set('Cookie', asing.cookie);
      expect([403, 404]).toContain(ditolak.status);
    }
  });

  it('mengganti berkas lama, dan menghapusnya bersama barisnya', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    await unggah(master.cookie, master.csrfToken, PDF, 200);
    const pertama = await h.prisma.lessonMaterial.findUniqueOrThrow({ where: { lessonId } });

    await unggah(master.cookie, master.csrfToken, PDF, 200);
    const kedua = await h.prisma.lessonMaterial.findUniqueOrThrow({ where: { lessonId } });
    // Satu pelajaran tetap satu berkas; penggantian tidak menumpuk baris.
    expect(kedua.objectKey).not.toBe(pertama.objectKey);
    expect(await h.prisma.lessonMaterial.count({ where: { lessonId } })).toBe(1);

    await request(h.server)
      .delete(`${prefix}/admin/lessons/${lessonId}/material`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(204);
    expect(await h.prisma.lessonMaterial.count({ where: { lessonId } })).toBe(0);
  });
});
