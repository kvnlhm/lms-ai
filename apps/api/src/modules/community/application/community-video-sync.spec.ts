import { CommunityAttachmentService } from './community-attachment.service';

/**
 * Penyelarasan status video saat lampiran dibaca.
 *
 * Penyedia tidak mengabari kita ketika transcode selesai, dan tidak ada pekerja
 * yang menanyakannya. Video kursus lolos dari masalah ini karena Master membuka
 * perpustakaan video dan penyelarasan menumpang di sana — tetapi tidak ada
 * Pelajar yang membuka perpustakaan admin. Tanpa penyelarasan di jalur baca
 * komunitas, video postingan tercatat PROCESSING selamanya.
 */
describe('CommunityAttachmentService — penyelarasan video saat dibaca', () => {
  function service(baris: unknown[], selaraskan = jest.fn().mockResolvedValue('AVAILABLE')) {
    const prisma = { communityPostAttachment: { findMany: jest.fn().mockResolvedValue(baris) } };
    const penyedia = { siapkanUnggahan: jest.fn(), selaraskan };
    const config = {
      get: jest.fn().mockReturnValue({
        communityAttachment: { storagePath: '/tmp', maxUploadBytes: 1, maxDraftUploadBytes: 1, maxPerPost: 10 },
        video: { playbackTtlSeconds: 300, bunny: { cdnHostname: 'cdn.uji', tokenAuthKey: 'kunci' } },
      }),
    };
    return {
      value: new CommunityAttachmentService(prisma as never, config as never, { record: jest.fn() } as never, penyedia as never),
      selaraskan,
    };
  }

  const lampiran = (id: string, status: string, assetId = 'aset-' + id) => ({
    id, originalName: 'klip.mp4', mimeType: 'video/mp4', sizeBytes: 1n, position: 0,
    createdAt: new Date('2026-08-08T00:00:00Z'), width: null, height: null,
    videoAsset: { id: assetId, status, providerVideoId: 'bunny-' + id },
  });

  test('video yang masih diproses ditanyakan ke penyedia', async () => {
    const { value, selaraskan } = service([lampiran('1', 'PROCESSING')]);

    const [hasil] = await value.listDrafts('pelajar-1');

    expect(selaraskan).toHaveBeenCalledWith('aset-1');
    // Status terbaru langsung dipakai, bukan menunggu pembacaan berikutnya.
    expect(hasil!.video).toMatchObject({ status: 'AVAILABLE' });
    expect(hasil!.video!.playbackUrl).toContain('cdn.uji');
  });

  test('video yang sudah siap tidak ditanyakan lagi', async () => {
    const { value, selaraskan } = service([lampiran('1', 'AVAILABLE')]);

    await value.listDrafts('pelajar-1');

    expect(selaraskan).not.toHaveBeenCalled();
  });

  test('video yang sudah gagal tidak ditanyakan lagi', async () => {
    const { value, selaraskan } = service([lampiran('1', 'FAILED')]);

    await value.listDrafts('pelajar-1');

    expect(selaraskan).not.toHaveBeenCalled();
  });

  test('lampiran bukan video tidak memicu satu pun panggilan', async () => {
    const { value, selaraskan } = service([
      { ...lampiran('1', 'PROCESSING'), mimeType: 'image/webp', videoAsset: null },
    ]);

    await value.listDrafts('pelajar-1');

    expect(selaraskan).not.toHaveBeenCalled();
  });

  test('satu aset yang muncul berkali-kali hanya ditanyakan sekali', async () => {
    const { value, selaraskan } = service([
      lampiran('1', 'PROCESSING', 'aset-sama'),
      lampiran('2', 'PROCESSING', 'aset-sama'),
    ]);

    await value.listDrafts('pelajar-1');

    expect(selaraskan).toHaveBeenCalledTimes(1);
  });

  test('penyedia yang gagal dihubungi tidak menjatuhkan pembacaan', async () => {
    // Yang dilihat pembaca tetap "sedang disiapkan", bukan halaman yang gagal.
    const { value } = service([lampiran('1', 'PROCESSING')], jest.fn().mockRejectedValue(new Error('jaringan')));

    const [hasil] = await value.listDrafts('pelajar-1');

    expect(hasil!.video).toMatchObject({ status: 'PROCESSING', playbackUrl: null });
  });

  test('jumlah aset yang ditanyakan dibatasi supaya satu umpan tidak menjadi puluhan permintaan', async () => {
    const banyak = Array.from({ length: 30 }, (_, i) => lampiran(String(i), 'PROCESSING'));
    const { value, selaraskan } = service(banyak);

    await value.listDrafts('pelajar-1');

    expect(selaraskan.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
