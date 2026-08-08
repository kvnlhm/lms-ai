import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { AvatarService } from './avatar.service';

function gambar(width: number, height: number, orientation?: number) {
  const dasar = sharp({ create: { width, height, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 128, sigma: 40 } } });
  return (orientation ? dasar.withMetadata({ orientation }) : dasar).png().toBuffer();
}

const dimensi = (berkas: Buffer) => sharp(berkas).metadata().then(({ width, height, format }) => ({ width, height, format }));

describe('AvatarService', () => {
  let storage = '';
  beforeEach(async () => { storage = await mkdtemp(join(tmpdir(), 'avatar-')); });
  afterEach(async () => { await rm(storage, { recursive: true, force: true }); });

  function service(batasByte = 20_000_000) {
    const update = jest.fn().mockResolvedValue({});
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ avatarUrl: null }), update } };
    const config = { get: jest.fn().mockReturnValue({ avatar: { storagePath: storage, maxUploadBytes: batasByte } }) };
    return { value: new AvatarService(prisma as never, config as never), update };
  }

  test('foto profil disimpan sebagai WebP, dan URL-nya menyebut ekstensi itu', async () => {
    const { value } = service();
    const asli = await gambar(400, 400);

    const { avatarUrl } = await value.upload('pengguna-1', Readable.from(asli), 'image/png', asli.length);

    expect(avatarUrl).toMatch(/^\/api\/v1\/auth\/avatars\/[0-9a-z-]+\.webp$/);
  });

  test('foto besar dikecilkan jauh; avatar tidak pernah tampil lebih dari 40 piksel', async () => {
    // Foto ponsel penuh diunduh untuk lingkaran 38 piksel di setiap kartu
    // postingan, dan satu halaman feed memuat puluhan di antaranya.
    const { value } = service();
    const asli = await gambar(2000, 2000);

    await value.upload('pengguna-1', Readable.from(asli), 'image/png', asli.length);

    const [berkas] = await readdir(storage);
    await expect(dimensi(await readFile(join(storage, berkas!)))).resolves.toEqual({ width: 256, height: 256, format: 'webp' });
  });

  test('foto yang sudah kecil tidak diperbesar', async () => {
    const { value } = service();
    const asli = await gambar(120, 120);

    await value.upload('pengguna-1', Readable.from(asli), 'image/png', asli.length);

    const [berkas] = await readdir(storage);
    await expect(dimensi(await readFile(join(storage, berkas!)))).resolves.toMatchObject({ width: 120, height: 120 });
  });

  test('orientasi EXIF diterapkan sebelum disimpan', async () => {
    const { value } = service();
    const asli = await gambar(400, 200, 6);

    await value.upload('pengguna-1', Readable.from(asli), 'image/png', asli.length);

    const [berkas] = await readdir(storage);
    const { width, height } = await dimensi(await readFile(join(storage, berkas!)));
    expect(height).toBeGreaterThan(width!);
  });

  test('gambar rusak yang lolos magic byte ditolak tanpa meninggalkan berkas', async () => {
    const { value, update } = service();
    const rusak = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(32, 9)]);

    await expect(value.upload('pengguna-1', Readable.from(rusak), 'image/png', rusak.length)).rejects.toMatchObject({ status: 422 });
    expect(update).not.toHaveBeenCalled();
    expect(await readdir(storage)).toEqual([]);
  });
});
