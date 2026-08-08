import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { login, prefix, startHarness, type Harness } from './support/harness';

const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

/** Foto sebesar keluaran ponsel, berisi derau supaya tidak terkompresi habis. */
const foto = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).jpeg().toBuffer();

describe('Lampiran komunitas', () => {
  let h: Harness;
  const storage = process.env.COMMUNITY_ATTACHMENT_STORAGE_PATH ?? '/tmp/lms-ci-community-attachments';

  beforeAll(async () => {
    process.env.COMMUNITY_ATTACHMENT_STORAGE_PATH = storage;
    h = await startHarness();
  });

  afterAll(async () => {
    const sisa = await h.prisma.communityPostAttachment.findMany({ select: { objectKey: true } });
    await h.prisma.communityPostAttachment.deleteMany({});
    await Promise.all(sisa.map((row) => rm(join(storage, row.objectKey), { force: true })));
    await h.close();
  });

  async function unggah(isi: Buffer, mime: string, nama: string) {
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const hasil = await request(h.server)
      .put(`${prefix}/community/attachments`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .set('Content-Type', mime)
      .set('X-File-Name', nama)
      .send(isi)
      .expect(201);
    return { student, lampiran: hasil.body.data as { id: string; mimeType: string; sizeBytes: string; width: number | null; height: number | null } };
  }

  it('mengecilkan foto besar dan melaporkan dimensinya kepada klien', async () => {
    const asli = await foto(3000, 2000);

    const { lampiran } = await unggah(asli, 'image/jpeg', 'liburan.jpg');

    expect(lampiran.mimeType).toBe('image/webp');
    expect({ width: lampiran.width, height: lampiran.height }).toEqual({ width: 1600, height: 1067 });
    // Yang menentukan bukan berapa yang diunggah, melainkan berapa yang akan
    // diunduh setiap pembaca postingan itu.
    expect(Number(lampiran.sizeBytes)).toBeLessThan(asli.length);
  });

  it('menyajikan lampiran lewat reverse proxy, boleh disimpan browser tetapi selalu divalidasi ulang', async () => {
    const { student, lampiran } = await unggah(await foto(800, 600), 'image/jpeg', 'kecil.jpg');

    const dibaca = await request(h.server)
      .get(`${prefix}/community/attachments/${lampiran.id}`)
      .set('Cookie', student.cookie)
      .expect(200);

    expect(dibaca.headers['x-accel-redirect']).toMatch(/^\/protected-community-attachments\/[0-9a-f-]+\.webp$/);
    // `no-cache` menyimpan salinannya tetapi mewajibkan revalidasi, sehingga
    // otorisasi tetap dijalankan pada setiap permintaan — yang hilang hanyalah
    // pengiriman ulang bytenya. `no-store` membuang salinan itu, dan umpan
    // yang digulir naik-turun mengunduh setiap gambar berulang kali.
    expect(dibaca.headers['cache-control']).toBe('private, no-cache');
    expect(dibaca.headers['x-content-type-options']).toBe('nosniff');
  });

  it('menolak pembacaan tanpa sesi', async () => {
    const { lampiran } = await unggah(await foto(400, 300), 'image/jpeg', 'rahasia.jpg');

    await request(h.server).get(`${prefix}/community/attachments/${lampiran.id}`).expect(401);
  });

  it('menolak unggahan draf orang lain dibaca', async () => {
    const { lampiran } = await unggah(await foto(400, 300), 'image/jpeg', 'draf.jpg');
    const lain = await login(h.server, 'samuel@akademionline.id', 'Pelajar#Lokal12345');

    // Selama belum diterbitkan, berkasnya belum menjadi milik komunitas.
    await request(h.server)
      .get(`${prefix}/community/attachments/${lampiran.id}`)
      .set('Cookie', lain.cookie)
      .expect(404);
  });
});
