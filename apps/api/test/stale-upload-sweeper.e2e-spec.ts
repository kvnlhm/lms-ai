import { access, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { VideoStatus } from '@prisma/client';
import { StaleUploadSweeper } from '../src/shared/storage/stale-upload-sweeper.service';
import { login, prefix, startHarness, type Harness, type Session } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };

// Disamakan dengan spec unggahan masing-masing supaya keduanya menunjuk
// direktori yang sama ketika jest memakai ulang satu proses untuk beberapa
// berkas spec.
process.env.VIDEO_STORAGE_PATH ??= '/tmp/lms-test-videos';
process.env.LESSON_MATERIAL_STORAGE_PATH ??= '/tmp/lms-ci-materials';
const gudangVideo = process.env.VIDEO_STORAGE_PATH;
const gudangMateri = process.env.LESSON_MATERIAL_STORAGE_PATH;

/** Lebih tua dari ambang enam jam, dengan jarak yang tidak meragukan. */
const LAMA = new Date(Date.now() - 12 * 60 * 60 * 1_000);

async function ada(jalur: string): Promise<boolean> {
  try {
    await access(jalur);
    return true;
  } catch {
    return false;
  }
}

describe('Penyapuan unggahan terbengkalai', () => {
  let h: Harness;
  let master: Session;
  let penyapu: StaleUploadSweeper;
  const asetIds: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
    penyapu = h.app.get(StaleUploadSweeper);
    await mkdir(gudangVideo, { recursive: true });
    await mkdir(gudangMateri, { recursive: true });
  });

  afterAll(async () => {
    if (asetIds.length > 0) {
      await h.prisma.videoAsset.deleteMany({ where: { id: { in: asetIds } } });
    }
    // Berkas yang sengaja dibuat agar selamat dari sapuan tidak akan hilang
    // sendiri, dan yang berumur baru akan menua menjadi sampah di jalankan
    // berikutnya.
    await Promise.all(
      ['sapu-video-baru.mp4.uploading', 'sapu-video-selesai.mp4'].map((nama) =>
        rm(join(gudangVideo, nama), { force: true }),
      ),
    );
    await h.close();
  });

  /** Membuat aset yang berhenti di status `CREATED`, tanpa pernah diunggah. */
  async function niatUnggah(title: string): Promise<string> {
    const intent = await request(h.server)
      .post(`${prefix}/admin/videos/upload-intents`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({ title, fileName: 'video.mp4', mimeType: 'video/mp4', sizeBytes: 1_024 })
      .expect(201);

    const id = intent.body.data.videoAssetId as string;
    asetIds.push(id);
    return id;
  }

  /**
   * Memundurkan `updated_at` lewat SQL mentah.
   *
   * Kolomnya `@updatedAt`, sehingga Prisma menimpa nilai apa pun yang dikirim
   * lewat `update`.
   */
  async function mundurkan(id: string): Promise<void> {
    await h.prisma.$executeRaw`
      UPDATE video_assets SET updated_at = ${LAMA} WHERE id = ${id}::uuid`;
  }

  async function tulisBerkasSementara(direktori: string, nama: string, umur: Date) {
    const jalur = join(direktori, nama);
    await writeFile(jalur, 'separuh jadi');
    await utimes(jalur, umur, umur);
    return jalur;
  }

  it('membuang berkas .uploading yang mangkrak, di lebih dari satu direktori', async () => {
    const videoLama = await tulisBerkasSementara(
      gudangVideo,
      'sapu-video-lama.mp4.uploading',
      LAMA,
    );
    const materiLama = await tulisBerkasSementara(
      gudangMateri,
      'sapu-materi-lama.pdf.uploading',
      LAMA,
    );

    await penyapu.runOnce();

    expect(await ada(videoLama)).toBe(false);
    expect(await ada(materiLama)).toBe(false);
  });

  it('tidak menyentuh unggahan yang masih berjalan', async () => {
    // Unggahan besar yang belum selesai terus menulis, sehingga mtime-nya maju.
    // Itulah yang membedakannya dari yang mangkrak, dan yang membuat unggahan
    // sah berdurasi panjang tidak pernah tersapu di tengah jalan.
    const berjalan = await tulisBerkasSementara(
      gudangVideo,
      'sapu-video-baru.mp4.uploading',
      new Date(),
    );
    const asetBaru = await niatUnggah('Aset yang baru saja dibuat');

    await penyapu.runOnce();

    expect(await ada(berjalan)).toBe(true);
    const aset = await h.prisma.videoAsset.findUniqueOrThrow({ where: { id: asetBaru } });
    expect(aset.status).toBe(VideoStatus.CREATED);
  });

  it('tidak menyentuh berkas selesai yang kebetulan sudah lama', async () => {
    // Berkas video sungguhan berumur berbulan-bulan adalah keadaan normal.
    // Hanya akhiran `.uploading` yang menjadikan sebuah berkas sampah.
    const selesai = await tulisBerkasSementara(gudangVideo, 'sapu-video-selesai.mp4', LAMA);

    await penyapu.runOnce();

    expect(await ada(selesai)).toBe(true);
  });

  it('menutup aset yang mandek menjadi FAILED sehingga dapat dihapus lagi', async () => {
    const id = await niatUnggah('Unggahan yang tidak pernah selesai');
    await mundurkan(id);

    // Selama masih berstatus berjalan, aset ini buntu: tidak dapat diunggah
    // ulang karena `upload` menuntut `CREATED` yang belum tersentuh, dan tidak
    // dapat dibuang karena penghapusan menolak status berjalan.
    await request(h.server)
      .delete(`${prefix}/admin/videos/${id}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(422);

    const { baris } = await penyapu.runOnce();
    expect(baris).toBeGreaterThanOrEqual(1);

    const aset = await h.prisma.videoAsset.findUniqueOrThrow({ where: { id } });
    expect(aset.status).toBe(VideoStatus.FAILED);
    expect(aset.processingError).toContain('tidak pernah selesai');

    await request(h.server)
      .delete(`${prefix}/admin/videos/${id}`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(200);
  });

  it('dapat dijalankan berulang tanpa efek tambahan', async () => {
    await penyapu.runOnce();
    const kedua = await penyapu.runOnce();

    expect(kedua.berkas).toBe(0);
    expect(kedua.baris).toBe(0);
  });
});
