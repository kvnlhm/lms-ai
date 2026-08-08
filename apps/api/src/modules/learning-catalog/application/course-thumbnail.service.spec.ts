import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { CourseThumbnailService } from './course-thumbnail.service';

/** PNG sungguhan berisi derau; gambar warna rata tidak dapat menunjukkan pengecilan. */
function gambar(width: number, height: number, orientation?: number) {
  const dasar = sharp({ create: { width, height, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 128, sigma: 40 } } });
  return (orientation ? dasar.withMetadata({ orientation }) : dasar).png().toBuffer();
}

const dimensi = (berkas: Buffer) => sharp(berkas).metadata().then(({ width, height, format }) => ({ width, height, format }));

describe('CourseThumbnailService', () => {
  let storage = '';
  beforeEach(async () => { storage = await mkdtemp(join(tmpdir(), 'course-thumbnail-')); });
  afterEach(async () => { await rm(storage, { recursive: true, force: true }); });

  function service(batasByte = 20_000_000) {
    const update = jest.fn().mockResolvedValue({});
    const prisma = { course: { findUnique: jest.fn().mockResolvedValue({ thumbnailUrl: null }), update } };
    const config = { get: jest.fn().mockReturnValue({ courseThumbnail: { storagePath: storage, maxUploadBytes: batasByte } }) };
    return { value: new CourseThumbnailService(prisma as never, config as never), update };
  }

  test('thumbnail disimpan sebagai WebP, dan URL-nya menyebut ekstensi itu', async () => {
    const { value } = service();
    const asli = await gambar(400, 300);

    const { thumbnailUrl } = await value.upload('kursus-1', Readable.from(asli), 'image/png', asli.length);

    expect(thumbnailUrl).toMatch(/^\/api\/v1\/courses\/thumbnails\/[0-9a-z-]+\.webp$/);
    expect(await readdir(storage)).toEqual([expect.stringMatching(/\.webp$/)]);
  });

  test('thumbnail besar dikecilkan; katalog memuat puluhan sekaligus', async () => {
    // Halaman katalog menampilkan seluruh kursus, jadi setiap megabyte di sini
    // dikalikan jumlah kartunya.
    const { value } = service();
    const asli = await gambar(3000, 2000);

    await value.upload('kursus-1', Readable.from(asli), 'image/png', asli.length);

    const [berkas] = await readdir(storage);
    await expect(dimensi(await readFile(join(storage, berkas!)))).resolves.toEqual({ width: 1200, height: 800, format: 'webp' });
  });

  test('thumbnail yang sudah kecil tidak diperbesar', async () => {
    const { value } = service();
    const asli = await gambar(320, 180);

    await value.upload('kursus-1', Readable.from(asli), 'image/png', asli.length);

    const [berkas] = await readdir(storage);
    await expect(dimensi(await readFile(join(storage, berkas!)))).resolves.toMatchObject({ width: 320, height: 180 });
  });

  test('orientasi EXIF diterapkan sebelum disimpan', async () => {
    const { value } = service();
    const asli = await gambar(800, 400, 6);

    await value.upload('kursus-1', Readable.from(asli), 'image/png', asli.length);

    const [berkas] = await readdir(storage);
    await expect(dimensi(await readFile(join(storage, berkas!)))).resolves.toMatchObject({ width: 400, height: 800 });
  });

  test('gambar rusak yang lolos magic byte ditolak tanpa meninggalkan berkas', async () => {
    const { value, update } = service();
    const rusak = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(32, 9)]);

    await expect(value.upload('kursus-1', Readable.from(rusak), 'image/png', rusak.length)).rejects.toMatchObject({ status: 422 });
    expect(update).not.toHaveBeenCalled();
    expect(await readdir(storage)).toEqual([]);
  });
});
