import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { CommunityAttachmentService } from './community-attachment.service';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

describe('CommunityAttachmentService', () => {
  let storage = '';
  beforeEach(async () => { storage = await mkdtemp(join(tmpdir(), 'community-attachment-')); });
  afterEach(async () => { await rm(storage, { recursive: true, force: true }); });

  function service(overrides: Record<string, unknown> = {}, maxPerPost = 5) {
    const create = jest.fn().mockImplementation(({ data }) => ({ id: 'attachment-1', position: 0, ...data, createdAt: new Date('2026-08-07T00:00:00Z') }));
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: (jalankan: (tx: unknown) => unknown) => jalankan(prisma),
      communityPost: { findFirst: jest.fn().mockResolvedValue({ id: 'post-1', authorId: 'master-1', attachments: [] }) },
      communityPostAttachment: { create, deleteMany, count, findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), delete: jest.fn(), update: jest.fn() },
      ...overrides,
    };
    const config = { get: jest.fn().mockReturnValue({ communityAttachment: { storagePath: storage, maxUploadBytes: 1024, maxDraftUploadBytes: 1024, maxPerPost } }) };
    return { value: new CommunityAttachmentService(prisma as never, config as never, { record: jest.fn() } as never), prisma, create, deleteMany, count };
  }

  test('menyimpan PNG valid dengan object key acak, bukan nama dari client', async () => {
    const { value, create } = service();

    const result = await value.upload('post-1', 'master-1', false, Readable.from(PNG), 'image/png', '../../foto.png', PNG.length);

    const objectKey = create.mock.calls[0][0].data.objectKey as string;
    expect(objectKey).toMatch(/^[0-9a-f-]+\.png$/);
    expect(await readFile(join(storage, objectKey))).toEqual(PNG);
    expect(result).toMatchObject({ originalName: '.._.._foto.png', mimeType: 'image/png', sizeBytes: String(PNG.length) });
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
    const { value, create } = service();

    await value.uploadDraft('pelajar-1', Readable.from(PNG), 'image/png', 'foto.png', PNG.length);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ postId: null, uploaderId: 'pelajar-1' }),
    }));
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
    });

    await value.upload('post-1', 'master-1', false, Readable.from(PNG), 'image/png', 'baru.png', PNG.length);

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
