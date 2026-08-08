import { VideoProvider, VideoStatus } from '@prisma/client';
import { CommunityAttachmentService } from './community-attachment.service';

/**
 * Penyajian lampiran video yang isinya dititipkan ke Bunny Stream.
 *
 * Yang dijaga di sini adalah jalur bacanya, dan syaratnya satu: lampiran
 * berkas lokal harus tetap tampil persis seperti sebelumnya. Kedua jenis hidup
 * berdampingan selama pemindahan, dan pembaca tidak boleh melihat bedanya
 * selain videonya kini diputar dari CDN.
 */
describe('CommunityAttachmentService — lampiran video Bunny', () => {
  const BUNNY = { cdnHostname: 'vz-uji.b-cdn.net', tokenAuthKey: 'kunci-uji' };

  function service(baris: unknown[]) {
    const findMany = jest.fn().mockResolvedValue(baris);
    const prisma = { communityPostAttachment: { findMany } };
    const config = {
      get: jest.fn().mockReturnValue({
        communityAttachment: { storagePath: '/tmp', maxUploadBytes: 1, maxDraftUploadBytes: 1, maxPerPost: 10 },
        video: { playbackTtlSeconds: 300, bunny: BUNNY },
      }),
    };
    return {
      value: new CommunityAttachmentService(prisma as never, config as never, { record: jest.fn() } as never, { siapkanUnggahan: jest.fn(), selaraskan: jest.fn() } as never),
      findMany,
    };
  }

  const dasar = {
    id: 'lampiran-1', originalName: 'klip.mp4', mimeType: 'video/mp4',
    sizeBytes: 1234n, position: 0, createdAt: new Date('2026-08-08T00:00:00Z'),
    width: null, height: null,
  };

  const asetSiap = {
    id: 'aset-1', status: VideoStatus.AVAILABLE,
    provider: VideoProvider.BUNNY_STREAM, providerVideoId: 'bunny-abc',
  };

  test('lampiran berkas lokal tidak membawa keterangan video sama sekali', async () => {
    // Inilah yang menjaga postingan lama tetap tampil apa adanya selama
    // pemindahan berlangsung.
    const { value } = service([{ ...dasar, mimeType: 'image/webp', videoAsset: null }]);

    const [hasil] = await value.listDrafts('pelajar-1');

    expect(hasil).toMatchObject({ id: 'lampiran-1', mimeType: 'image/webp' });
    expect(hasil!.video).toBeNull();
  });

  test('video yang sudah siap dibawakan bersama URL playback bertanda tangan', async () => {
    const { value } = service([{ ...dasar, videoAsset: asetSiap }]);

    const [hasil] = await value.listDrafts('pelajar-1');

    expect(hasil!.video).toMatchObject({ status: 'AVAILABLE' });
    expect(hasil!.video!.playbackUrl).toContain('vz-uji.b-cdn.net');
    expect(hasil!.video!.playbackUrl).toContain('/bunny-abc/');
    // Bertanda tangan dan bermasa berlaku: tautan yang bocor tidak berlaku
    // selamanya.
    expect(hasil!.video!.playbackUrl).toContain('bcdn_token=');
    expect(hasil!.video!.playbackUrl).toContain('expires=');
  });

  test('video yang masih diproses tidak diberi URL, supaya pemutar tidak dibuka pada berkas yang belum ada', async () => {
    const { value } = service([{ ...dasar, videoAsset: { ...asetSiap, status: VideoStatus.PROCESSING } }]);

    const [hasil] = await value.listDrafts('pelajar-1');

    expect(hasil!.video).toMatchObject({ status: 'PROCESSING', playbackUrl: null });
  });

  test('video yang gagal diproses dinyatakan gagal, bukan dibiarkan menggantung', async () => {
    const { value } = service([{ ...dasar, videoAsset: { ...asetSiap, status: VideoStatus.FAILED } }]);

    const [hasil] = await value.listDrafts('pelajar-1');

    expect(hasil!.video).toMatchObject({ status: 'FAILED', playbackUrl: null });
  });

  test('kueri lampiran ikut mengambil aset videonya, bukan menambah kueri per baris', async () => {
    const { value, findMany } = service([]);

    await value.listDrafts('pelajar-1');

    expect(findMany.mock.calls[0][0].select).toMatchObject({
      videoAsset: { select: expect.objectContaining({ status: true, providerVideoId: true }) },
    });
  });
});
