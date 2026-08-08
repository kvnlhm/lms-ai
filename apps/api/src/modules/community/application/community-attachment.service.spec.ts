import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { CommunityAttachmentService } from './community-attachment.service';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

/**
 * PNG sungguhan berisi derau, bukan warna rata: gambar rata terkompresi
 * menjadi beberapa ratus byte, sehingga tidak dapat menunjukkan apa pun
 * tentang pengecilan ukuran.
 */
function gambar(width: number, height: number, orientation?: number) {
  const dasar = sharp({ create: { width, height, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 128, sigma: 40 } } });
  return (orientation ? dasar.withMetadata({ orientation }) : dasar).png().toBuffer();
}

const dimensi = (berkas: Buffer) => sharp(berkas).metadata().then(({ width, height, format }) => ({ width, height, format }));

describe('CommunityAttachmentService', () => {
  let storage = '';
  beforeEach(async () => { storage = await mkdtemp(join(tmpdir(), 'community-attachment-')); });
  afterEach(async () => { await rm(storage, { recursive: true, force: true }); });

  function service(overrides: Record<string, unknown> = {}, maxPerPost = 5, batasByte = 1024) {
    const create = jest.fn().mockImplementation(({ data }) => ({ id: 'attachment-1', position: 0, ...data, createdAt: new Date('2026-08-07T00:00:00Z') }));
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: (jalankan: (tx: unknown) => unknown) => jalankan(prisma),
      communityPost: { findFirst: jest.fn().mockResolvedValue({ id: 'post-1', authorId: 'master-1', attachments: [] }) },
      communityPostAttachment: { create, deleteMany, count, findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), delete: jest.fn(), update: jest.fn() },
      ...overrides,
    };
    const config = { get: jest.fn().mockReturnValue({ communityAttachment: { storagePath: storage, maxUploadBytes: batasByte, maxDraftUploadBytes: batasByte, maxPerPost } }) };
    return { value: new CommunityAttachmentService(prisma as never, config as never, { record: jest.fn() } as never), prisma, create, deleteMany, count };
  }

  test('menyimpan gambar dengan object key acak, bukan nama dari client', async () => {
    const { value, create } = service({}, 5, 5_000_000);
    const asli = await gambar(400, 300);

    const result = await value.upload('post-1', 'master-1', false, Readable.from(asli), 'image/png', '../../foto.png', asli.length);

    const objectKey = create.mock.calls[0][0].data.objectKey as string;
    expect(objectKey).toMatch(/^[0-9a-f-]+\.webp$/);
    expect(result).toMatchObject({ originalName: '.._.._foto.png', mimeType: 'image/webp' });
  });

  test('gambar yang melebihi sisi terpanjang dikecilkan, rasionya dipertahankan', async () => {
    // Foto ponsel 12 MP dikirim utuh ke kartu selebar beberapa ratus piksel
    // adalah sebab utama umpan terasa berat.
    const { value, create } = service({}, 5, 20_000_000);
    const asli = await gambar(3000, 2000);

    await value.upload('post-1', 'master-1', false, Readable.from(asli), 'image/png', 'foto.png', asli.length);

    const objectKey = create.mock.calls[0][0].data.objectKey as string;
    await expect(dimensi(await readFile(join(storage, objectKey)))).resolves.toEqual({ width: 1600, height: 1067, format: 'webp' });
  });

  test('gambar yang sudah kecil tidak diperbesar', async () => {
    const { value, create } = service({}, 5, 5_000_000);
    const asli = await gambar(320, 240);

    await value.upload('post-1', 'master-1', false, Readable.from(asli), 'image/png', 'kecil.png', asli.length);

    const objectKey = create.mock.calls[0][0].data.objectKey as string;
    await expect(dimensi(await readFile(join(storage, objectKey)))).resolves.toMatchObject({ width: 320, height: 240 });
  });

  test('dimensi hasil olahan disimpan agar kartu tidak melompat saat gambar dimuat', async () => {
    const { value, create } = service({}, 5, 20_000_000);
    const asli = await gambar(3000, 2000);

    await value.upload('post-1', 'master-1', false, Readable.from(asli), 'image/png', 'foto.png', asli.length);

    expect(create.mock.calls[0][0].data).toMatchObject({ width: 1600, height: 1067 });
  });

  test('sizeBytes yang dicatat adalah ukuran berkas hasil olahan, bukan unggahan aslinya', async () => {
    // Tanpa ini basis data melaporkan ukuran yang tidak pernah dikirim ke
    // siapa pun, dan `ukuranTerbaca` di kartu memperlihatkan angka yang salah.
    const { value, create } = service({}, 5, 20_000_000);
    const asli = await gambar(3000, 2000);

    await value.upload('post-1', 'master-1', false, Readable.from(asli), 'image/png', 'foto.png', asli.length);

    const { objectKey, sizeBytes } = create.mock.calls[0][0].data as { objectKey: string; sizeBytes: bigint };
    expect(sizeBytes).toBe(BigInt((await readFile(join(storage, objectKey))).length));
    expect(sizeBytes).toBeLessThan(BigInt(asli.length));
  });

  test('orientasi EXIF diterapkan sebelum disimpan, bukan diserahkan ke browser', async () => {
    // Re-encode membuang blok EXIF. Tanpa memutar lebih dulu, foto potret dari
    // ponsel tersimpan miring dan tidak ada lagi tanda yang memberitahu browser.
    const { value, create } = service({}, 5, 20_000_000);
    const asli = await gambar(800, 400, 6);

    await value.upload('post-1', 'master-1', false, Readable.from(asli), 'image/png', 'potret.png', asli.length);

    const objectKey = create.mock.calls[0][0].data.objectKey as string;
    await expect(dimensi(await readFile(join(storage, objectKey)))).resolves.toMatchObject({ width: 400, height: 800 });
  });

  test('berkas bukan gambar disimpan apa adanya dan tanpa dimensi', async () => {
    const { value, create } = service();
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 7)]);

    await value.upload('post-1', 'master-1', false, Readable.from(pdf), 'application/pdf', 'materi.pdf', pdf.length);

    const { objectKey, width, height, sizeBytes } = create.mock.calls[0][0].data as { objectKey: string; width: number | null; height: number | null; sizeBytes: bigint };
    expect(await readFile(join(storage, objectKey))).toEqual(pdf);
    expect({ width, height, sizeBytes }).toEqual({ width: null, height: null, sizeBytes: BigInt(pdf.length) });
  });

  test('gambar rusak yang lolos magic byte ditolak dan tidak meninggalkan berkas', async () => {
    const { value, create } = service();
    const rusak = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(32, 9)]);

    await expect(value.upload('post-1', 'master-1', false, Readable.from(rusak), 'image/png', 'rusak.png', rusak.length))
      .rejects.toMatchObject({ status: 422 });
    expect(create).not.toHaveBeenCalled();
    expect(await readdir(storage)).toEqual([]);
  });

  test('menolak isi yang menyamar sebagai PDF dan tidak menyimpan metadata', async () => {
    const { value, create } = service();
    const palsu = Buffer.from('bukan pdf');

    await expect(value.upload('post-1', 'master-1', false, Readable.from(palsu), 'application/pdf', 'palsu.pdf', palsu.length))
      .rejects.toMatchObject({ status: 422 });
    expect(create).not.toHaveBeenCalled();
    expect(await readdir(storage)).toEqual([]);
  });

  test('unggahan composer disimpan tanpa postId sampai diterbitkan', async () => {
    const { value, create } = service({}, 5, 5_000_000);
    const asli = await gambar(400, 300);

    await value.uploadDraft('pelajar-1', Readable.from(asli), 'image/png', 'foto.png', asli.length);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ postId: null, uploaderId: 'pelajar-1' }),
    }));
  });

  test('mengembalikan draf milik penulis untuk pemulihan composer', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'draft-1', originalName: 'foto.png', mimeType: 'image/png', sizeBytes: 12n, position: 0, createdAt: new Date('2026-08-07T00:00:00Z') }]);
    const { value } = service({ communityPostAttachment: { findMany } });

    await expect(value.listDrafts('pelajar-1')).resolves.toEqual([expect.objectContaining({ id: 'draft-1', sizeBytes: '12' })]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { uploaderId: 'pelajar-1', postId: null } }));
  });

  test('unggahan composer yang menumpuk ditolak sebelum berkasnya ditulis', async () => {
    // Tanpa batas ini, membuka dan menutup composer berulang kali memenuhi disk
    // tanpa satu pun postingan terbit.
    const { value, create } = service({ communityPostAttachment: { count: jest.fn().mockResolvedValue(5), create: jest.fn() } });

    await expect(value.uploadDraft('pelajar-1', Readable.from(PNG), 'image/png', 'foto.png', PNG.length))
      .rejects.toMatchObject({ status: 422 });
    expect(create).not.toHaveBeenCalled();
    expect(await readdir(storage)).toEqual([]);
  });

  test('checklist tetap berlampir satu berkas: unggahan baru membuang yang lama', async () => {
    const { value, deleteMany } = service({
      communityPost: { findFirst: jest.fn().mockResolvedValue({ id: 'post-1', authorId: 'master-1', attachments: [{ id: 'lama', objectKey: 'lama.png' }] }) },
    }, 5, 5_000_000);
    const asli = await gambar(400, 300);

    await value.upload('post-1', 'master-1', false, Readable.from(asli), 'image/png', 'baru.png', asli.length);

    expect(deleteMany).toHaveBeenCalledWith({ where: { postId: 'post-1' } });
  });

  describe('bind', () => {
    function tx(ditemukan: { id: string }[]) {
      return {
        communityPostAttachment: {
          findMany: jest.fn().mockResolvedValue(ditemukan),
          update: jest.fn().mockResolvedValue({}),
        },
      };
    }

    test('menyimpan urutan yang dipilih penulisnya sebagai position', async () => {
      const { value } = service();
      const client = tx([{ id: 'b' }, { id: 'a' }]);

      await value.bind(client as never, 'post-1', 'pelajar-1', ['a', 'b']);

      expect(client.communityPostAttachment.update).toHaveBeenNthCalledWith(1, { where: { id: 'a' }, data: { postId: 'post-1', position: 0 } });
      expect(client.communityPostAttachment.update).toHaveBeenNthCalledWith(2, { where: { id: 'b' }, data: { postId: 'post-1', position: 1 } });
    });

    test('menolak id yang bukan milik penulisnya atau sudah dipakai postingan lain', async () => {
      // `findMany` sudah menyaring uploaderId dan postId null; yang kurang
      // berarti salah satu syarat itu tidak terpenuhi.
      const { value } = service();
      const client = tx([{ id: 'a' }]);

      await expect(value.bind(client as never, 'post-1', 'pelajar-1', ['a', 'milik-orang-lain']))
        .rejects.toMatchObject({ status: 422 });
      expect(client.communityPostAttachment.update).not.toHaveBeenCalled();
    });

    test('menolak lampiran yang disebut dua kali', async () => {
      const { value } = service();
      const client = tx([{ id: 'a' }]);

      await expect(value.bind(client as never, 'post-1', 'pelajar-1', ['a', 'a']))
        .rejects.toMatchObject({ status: 422 });
    });

    test('menolak lebih dari batas per postingan', async () => {
      const { value } = service({}, 2);
      const client = tx([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

      await expect(value.bind(client as never, 'post-1', 'pelajar-1', ['a', 'b', 'c']))
        .rejects.toMatchObject({ status: 422 });
      expect(client.communityPostAttachment.findMany).not.toHaveBeenCalled();
    });
  });

  test('mengganti lampiran postingan hanya dengan milik penulis atau unggahan drafnya', async () => {
    const update = jest.fn().mockResolvedValue({});
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const findMany = jest.fn()
      .mockResolvedValueOnce([{ id: 'lama', objectKey: 'lama.png' }])
      .mockResolvedValueOnce([{ id: 'baru' }]);
    const { value } = service();

    await expect(value.replace({ communityPostAttachment: { findMany, deleteMany, update } } as never, 'post-1', 'pelajar-1', ['baru']))
      .resolves.toEqual(['lama.png']);
    expect(deleteMany).toHaveBeenCalledWith({ where: { postId: 'post-1', id: { notIn: ['baru'] } } });
  });

  test('penyapu membuang unggahan yang tidak pernah diterbitkan beserta berkasnya', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const { value } = service({
      communityPostAttachment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a', objectKey: 'a.png' }]),
        deleteMany,
      },
    });

    await expect(value.closeStaleUploads(new Date('2026-08-07T00:00:00Z'))).resolves.toBe(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a'] } } });
  });

  test('penyapu tidak menyentuh unggahan yang sudah terikat postingan', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { value } = service({ communityPostAttachment: { findMany, deleteMany: jest.fn() } });

    await expect(value.closeStaleUploads(new Date('2026-08-07T00:00:00Z'))).resolves.toBe(0);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ postId: null }),
    }));
  });
});
