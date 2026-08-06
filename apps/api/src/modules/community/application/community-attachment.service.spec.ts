import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { CommunityAttachmentService } from './community-attachment.service';

describe('CommunityAttachmentService', () => {
  let storage = '';
  beforeEach(async () => { storage = await mkdtemp(join(tmpdir(), 'community-attachment-')); });
  afterEach(async () => { await rm(storage, { recursive: true, force: true }); });

  function service() {
    const upsert = jest.fn().mockImplementation(({ create }) => ({ id: 'attachment-1', ...create, createdAt: new Date('2026-08-06T00:00:00Z') }));
    const prisma = {
      communityPost: { findFirst: jest.fn().mockResolvedValue({ id: 'post-1', authorId: 'master-1', attachment: null }) },
      communityPostAttachment: { upsert },
    };
    const config = { get: jest.fn().mockReturnValue({ communityAttachment: { storagePath: storage, maxUploadBytes: 1024 } }) };
    return { value: new CommunityAttachmentService(prisma as never, config as never, { record: jest.fn() } as never), upsert };
  }

  test('menyimpan PNG valid dengan object key acak, bukan nama dari client', async () => {
    const { value, upsert } = service();
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

    const result = await value.upload('post-1', 'master-1', false, Readable.from(png), 'image/png', '../../foto.png', png.length);

    const objectKey = upsert.mock.calls[0][0].create.objectKey as string;
    expect(objectKey).toMatch(/^[0-9a-f-]+\.png$/);
    expect(await readFile(join(storage, objectKey))).toEqual(png);
    expect(result).toMatchObject({ originalName: '.._.._foto.png', mimeType: 'image/png', sizeBytes: String(png.length) });
  });

  test('menolak isi yang menyamar sebagai PDF dan tidak menyimpan metadata', async () => {
    const { value, upsert } = service();
    const palsu = Buffer.from('bukan pdf');

    await expect(value.upload('post-1', 'master-1', false, Readable.from(palsu), 'application/pdf', 'palsu.pdf', palsu.length))
      .rejects.toMatchObject({ status: 422 });
    expect(upsert).not.toHaveBeenCalled();
  });
});
