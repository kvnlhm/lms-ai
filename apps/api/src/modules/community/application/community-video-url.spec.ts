import { VideoStatus } from '@prisma/client';
import { CommunityAttachmentService } from './community-attachment.service';

/**
 * Kestabilan URL playback.
 *
 * Umpan komunitas menyegarkan dirinya tiap lima detik. Bila setiap penyegaran
 * menerbitkan URL yang berbeda, `src` pada elemen video ikut berubah, pemutar
 * dipasang ulang, dan tontonan kembali ke detik nol — tiap lima detik. Karena
 * itu URL harus tetap sama selama satu jendela, bukan ditandatangani ulang
 * pada setiap permintaan.
 */
describe('CommunityAttachmentService — kestabilan URL playback', () => {
  function service() {
    const prisma = { communityPostAttachment: { findMany: jest.fn().mockResolvedValue([baris()]) } };
    const config = {
      get: jest.fn().mockReturnValue({
        communityAttachment: { storagePath: '/tmp', maxUploadBytes: 1, maxDraftUploadBytes: 1, maxPerPost: 10 },
        video: { playbackTtlSeconds: 300, bunny: { cdnHostname: 'cdn.uji', tokenAuthKey: 'kunci' } },
      }),
    };
    return new CommunityAttachmentService(
      prisma as never, config as never, { record: jest.fn() } as never,
      { siapkanUnggahan: jest.fn(), selaraskan: jest.fn() } as never,
    );
  }

  const baris = () => ({
    id: 'lampiran-1', originalName: 'klip.mp4', mimeType: 'video/mp4', sizeBytes: 1n,
    position: 0, createdAt: new Date('2026-08-08T00:00:00Z'), width: null, height: null,
    videoAsset: { id: 'aset-1', status: VideoStatus.AVAILABLE, providerVideoId: 'bunny-1' },
  });

  afterEach(() => jest.useRealTimers());

  test('dua pembacaan berturut-turut menghasilkan URL yang sama persis', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-08T10:00:00Z'));
    const value = service();

    const [pertama] = await value.listDrafts('pelajar-1');
    // Penyegaran umpan berikutnya, lima detik kemudian.
    jest.setSystemTime(new Date('2026-08-08T10:00:05Z'));
    const [kedua] = await value.listDrafts('pelajar-1');

    expect(kedua!.video!.playbackUrl).toBe(pertama!.video!.playbackUrl);
  });

  test('URL tetap sama sepanjang jendela, walau puluhan penyegaran berlalu', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-08T10:00:00Z'));
    const value = service();
    const [awal] = await value.listDrafts('pelajar-1');

    // Dua menit penyegaran tiap lima detik.
    for (let detik = 5; detik <= 120; detik += 5) {
      jest.setSystemTime(new Date(`2026-08-08T10:0${detik < 60 ? '0' : '1'}:${String(detik % 60).padStart(2, '0')}Z`));
      const [kini] = await value.listDrafts('pelajar-1');
      expect(kini!.video!.playbackUrl).toBe(awal!.video!.playbackUrl);
    }
  });

  test('URL tetap berumur terbatas: jendela berikutnya menandatangani ulang', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-08T10:00:00Z'));
    const value = service();
    const [awal] = await value.listDrafts('pelajar-1');

    // Jauh melewati satu jendela.
    jest.setSystemTime(new Date('2026-08-08T10:30:00Z'));
    const [nanti] = await value.listDrafts('pelajar-1');

    expect(nanti!.video!.playbackUrl).not.toBe(awal!.video!.playbackUrl);
  });

  test('masa berlaku yang diterbitkan tidak pernah lebih pendek dari setengah TTL', async () => {
    // Kalau jendelanya dipatok tanpa menambah TTL, URL yang diterbitkan di
    // ujung jendela akan kedaluwarsa hampir seketika.
    jest.useFakeTimers().setSystemTime(new Date('2026-08-08T10:02:29Z'));
    const value = service();

    const [hasil] = await value.listDrafts('pelajar-1');

    const expires = Number(/expires=(\d+)/.exec(hasil!.video!.playbackUrl!)![1]);
    expect(expires * 1000 - Date.now()).toBeGreaterThanOrEqual(150_000);
  });
});
