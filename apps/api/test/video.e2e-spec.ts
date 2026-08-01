import { access, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { firstLessonOf, login, prefix, startHarness, type Harness, type Session } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

// Aplikasi memakai default `/data/videos`, sedangkan tes ini memeriksa
// `/tmp/lms-test-videos`. Tanpa menyetelnya di sini, keduanya hanya sepakat
// bila runner kebetulan mengekspor VIDEO_STORAGE_PATH — ketergantungan
// tersembunyi yang membuat tes gagal di lingkungan bersih.
process.env.VIDEO_STORAGE_PATH ??= '/tmp/lms-test-videos';
const storage = process.env.VIDEO_STORAGE_PATH;

/** ISO-BMFF minimal untuk menguji signature `ftyp`. */
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from('ftyp'),
  Buffer.from('isom'),
  Buffer.alloc(12),
]);

describe('Perpustakaan video self-hosted', () => {
  let h: Harness;
  let master: Session;
  const videoAssetIds: string[] = [];
  const lessonIds: string[] = [];
  // Kursus buatan test ini wajib dibereskan. Kursus draf yang tertinggal
  // membuat spec lain gagal: bookmark memungut "pelajaran dari kursus yang
  // tidak diikuti" dan menemukan draf, yang ditolak 404 sebelum sempat sampai
  // ke pemeriksaan enrollment yang sedang diuji.
  const courseIds: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
  });

  afterAll(async () => {
    if (lessonIds.length > 0) {
      await h.prisma.lesson.updateMany({
        where: { id: { in: lessonIds } },
        data: { videoAssetId: null },
      });
    }
    if (videoAssetIds.length > 0) {
      await h.prisma.videoPlaybackSession.deleteMany({
        where: { videoAssetId: { in: videoAssetIds } },
      });
      await h.prisma.lesson.updateMany({
        where: { videoAssetId: { in: videoAssetIds } },
        data: { videoAssetId: null },
      });
      await h.prisma.videoAsset.deleteMany({ where: { id: { in: videoAssetIds } } });
      await Promise.all(
        videoAssetIds.map((videoAssetId) =>
          rm(join(storage, `${videoAssetId}.mp4`), { force: true }),
        ),
      );
    }
    if (courseIds.length > 0) {
      await h.prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    }
    await h.close();
  });

  /** Mengunggah satu berkas ke perpustakaan dan mengembalikan id asetnya. */
  async function unggah(title: string): Promise<string> {
    const intent = await request(h.server)
      .post(`${prefix}/admin/videos/upload-intents`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ title, fileName: 'video.mp4', mimeType: 'video/mp4', sizeBytes: MP4.length })
      .expect(201);

    const videoAssetId = intent.body.data.videoAssetId as string;
    videoAssetIds.push(videoAssetId);

    await request(h.server)
      .put(`${prefix}/admin/videos/${videoAssetId}/content`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .set('Content-Type', 'video/mp4')
      .set('Content-Length', String(MP4.length))
      .send(MP4)
      .expect(200);

    return videoAssetId;
  }

  async function pasang(lessonId: string, videoAssetId: string, expected = 200) {
    return request(h.server)
      .put(`${prefix}/admin/lessons/${lessonId}/video`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ videoAssetId })
      .expect(expected);
  }

  /** Membuat kursus, bagian, dan satu pelajaran video kosong. */
  async function buatPelajaran(namaKursus: string): Promise<{ courseId: string; lessonId: string }> {
    const slug = `uji-video-${namaKursus}-${Date.now()}-${Math.floor(process.hrtime()[1] / 1000)}`;
    const course = await request(h.server)
      .post(`${prefix}/admin/courses`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ title: `Uji ${namaKursus}`, slug, level: 'BEGINNER' })
      .expect(201);
    const courseId = course.body.data.id as string;
    courseIds.push(courseId);

    const module = await request(h.server)
      .post(`${prefix}/admin/courses/${courseId}/modules`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ title: 'Bagian video' })
      .expect(201);

    const lesson = await request(h.server)
      .post(`${prefix}/admin/modules/${module.body.data.id as string}/lessons`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ title: 'Pelajaran video', contentType: 'VIDEO', isRequired: true })
      .expect(201);

    const lessonId = lesson.body.data.id as string;
    lessonIds.push(lessonId);
    return { courseId, lessonId };
  }

  it('mengunggah ke perpustakaan tanpa menyebut pelajaran mana pun', async () => {
    const videoAssetId = await unggah('Video perpustakaan');

    expect((await stat(storage)).mode & 0o777).toBe(0o755);
    expect((await stat(join(storage, `${videoAssetId}.mp4`))).mode & 0o777).toBe(0o644);

    const asset = await h.prisma.videoAsset.findUniqueOrThrow({ where: { id: videoAssetId } });
    expect(asset.status).toBe('AVAILABLE');
    // Barang perpustakaan berdiri sendiri: belum dipakai pelajaran mana pun.
    expect(await h.prisma.lesson.count({ where: { videoAssetId } })).toBe(0);
  });

  it('memakai satu berkas untuk dua pelajaran sekaligus', async () => {
    const videoAssetId = await unggah('Video dipakai bersama');
    const pertama = await buatPelajaran('berbagi-a');
    const kedua = await buatPelajaran('berbagi-b');

    await pasang(pertama.lessonId, videoAssetId);
    await pasang(kedua.lessonId, videoAssetId);

    // Inilah inti perpustakaan: satu berkas di disk, dua pelajaran memakainya.
    const library = await request(h.server)
      .get(`${prefix}/admin/videos`)
      .set('Cookie', master.cookie)
      .expect(200);

    const entri = (library.body.data.items as Array<Record<string, unknown>>).find(
      (item) => item.videoAssetId === videoAssetId,
    );
    expect(entri).toBeDefined();
    expect((entri!.usedBy as unknown[]).length).toBe(2);
  });

  it('memeriksa hak terhadap pelajaran pada sesinya, bukan pelajaran lain yang memakai berkas sama', async () => {
    // Regresi keamanan. Dulu penyajian berkas memeriksa hak lewat
    // `videoAsset.lessonId`, sehingga begitu satu aset dipakai dua pelajaran,
    // konteks yang diperiksa bisa berbeda dari pelajaran yang dibuka pelajar.
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const terdaftar = await firstLessonOf(h.prisma, 'video-editing-mastery');
    const videoAssetId = await unggah('Video lintas kursus');

    await pasang(terdaftar, videoAssetId);
    const asing = await buatPelajaran('tak-terdaftar');
    await pasang(asing.lessonId, videoAssetId);

    const playback = await request(h.server)
      .post(`${prefix}/learn/lessons/${terdaftar}/playback-sessions`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ deviceId: 'e2e-device' })
      .expect(201);

    const playbackId = playback.body.data.playbackSessionId as string;
    const content = await request(h.server)
      .get(`${prefix}/playback-sessions/${playbackId}/content`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(content.headers['x-accel-redirect']).toBe(`/protected-videos/${videoAssetId}.mp4`);

    // Kunci regresinya: sesi menyimpan pelajaran yang benar-benar dibuka,
    // bukan pelajaran mana pun yang kebetulan memakai berkas sama. Inilah
    // satu-satunya sumber kebenaran yang dipakai saat menyajikan berkasnya.
    const sesi = await h.prisma.videoPlaybackSession.findUniqueOrThrow({
      where: { id: playbackId },
      select: { lessonId: true },
    });
    expect(sesi.lessonId).toBe(terdaftar);
    expect(sesi.lessonId).not.toBe(asing.lessonId);

    // Pelajaran kedua tetap tidak terjangkau. Kursusnya masih draf, jadi
    // penolakannya datang sebagai 404 — lebih awal daripada pemeriksaan
    // enrollment, yang sudah punya cakupannya sendiri di spec otorisasi.
    await request(h.server)
      .post(`${prefix}/learn/lessons/${asing.lessonId}/playback-sessions`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({})
      .expect(404);

    // Sesi tetap milik satu pengguna, seperti sebelumnya.
    await request(h.server)
      .get(`${prefix}/playback-sessions/${playbackId}/content`)
      .set('Cookie', master.cookie)
      .expect(404);
  });

  it('mengganti video pelajaran tanpa membuang berkas lamanya', async () => {
    const lama = await unggah('Video lama');
    const baru = await unggah('Video baru');
    const { lessonId } = await buatPelajaran('ganti');

    await pasang(lessonId, lama);
    await pasang(lessonId, baru);

    // Perilaku lama menghapus berkas yang digantikan. Dalam perpustakaan itu
    // berbahaya — berkasnya bisa saja masih dipakai pelajaran lain.
    await expect(access(join(storage, `${lama}.mp4`))).resolves.toBeUndefined();
    const asset = await h.prisma.videoAsset.findUniqueOrThrow({ where: { id: lama } });
    expect(asset.status).toBe('AVAILABLE');
    expect(asset.deletedAt).toBeNull();
  });

  it('menolak menghapus aset yang masih dipakai, lalu menerimanya setelah dilepas', async () => {
    const videoAssetId = await unggah('Video yatim');
    const { lessonId } = await buatPelajaran('hapus');
    await pasang(lessonId, videoAssetId);

    await request(h.server)
      .delete(`${prefix}/admin/videos/${videoAssetId}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(422);

    await request(h.server)
      .delete(`${prefix}/admin/lessons/${lessonId}/video`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(200);

    await request(h.server)
      .delete(`${prefix}/admin/videos/${videoAssetId}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(200);

    expect(await h.prisma.videoAsset.findUnique({ where: { id: videoAssetId } })).toBeNull();
    await expect(access(join(storage, `${videoAssetId}.mp4`))).rejects.toThrow();
  });

  it('menghapus pelajaran hanya melepas videonya, berkasnya tetap di perpustakaan', async () => {
    const videoAssetId = await unggah('Video bertahan');
    const { courseId, lessonId } = await buatPelajaran('lesson-dihapus');
    await pasang(lessonId, videoAssetId);

    await request(h.server)
      .delete(`${prefix}/admin/lessons/${lessonId}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(204);

    // Aset milik perpustakaan, bukan milik pelajaran yang baru saja hilang.
    const asset = await h.prisma.videoAsset.findUnique({ where: { id: videoAssetId } });
    expect(asset).not.toBeNull();
    await expect(access(join(storage, `${videoAssetId}.mp4`))).resolves.toBeUndefined();

    await request(h.server)
      .delete(`${prefix}/admin/courses/${courseId}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(204);
  });

  it('menolak memasang aset yang unggahannya belum selesai', async () => {
    const intent = await request(h.server)
      .post(`${prefix}/admin/videos/upload-intents`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({
        title: 'Belum diunggah',
        fileName: 'belum.mp4',
        mimeType: 'video/mp4',
        sizeBytes: MP4.length,
      })
      .expect(201);
    const videoAssetId = intent.body.data.videoAssetId as string;
    videoAssetIds.push(videoAssetId);

    const { lessonId } = await buatPelajaran('belum-siap');
    await pasang(lessonId, videoAssetId, 422);
  });
});
