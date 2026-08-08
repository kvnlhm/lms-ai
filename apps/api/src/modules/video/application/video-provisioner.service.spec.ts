import { VideoProvider, VideoStatus } from '@prisma/client';
import { VideoProvisionerService } from './video-provisioner.service';

describe('VideoProvisionerService', () => {
  const TIKET = { videoId: 'bunny-1', libraryId: '9', signature: 'tanda', expires: 1, endpoint: 'https://tus' };

  function service(overrides: Record<string, unknown> = {}) {
    const create = jest.fn().mockResolvedValue({ id: 'aset-1' });
    const findFirst = jest.fn().mockResolvedValue({
      id: 'aset-1', provider: VideoProvider.BUNNY_STREAM,
      providerVideoId: 'bunny-1', status: VideoStatus.PROCESSING,
    });
    const update = jest.fn().mockResolvedValue({});
    const prisma = { videoAsset: { create, findFirst, update } };
    const bunny = {
      createVideo: jest.fn().mockResolvedValue('bunny-1'),
      uploadTicket: jest.fn().mockReturnValue(TIKET),
      fetchVideo: jest.fn().mockResolvedValue({ ready: true, failed: false, sizeBytes: 999 }),
      ...overrides,
    };
    return { value: new VideoProvisionerService(prisma as never, bunny as never), create, findFirst, update, bunny };
  }

  test('mencatat asetnya sebelum satu byte pun diunggah', async () => {
    // Unggahan yang gagal di tengah jalan harus tetap meninggalkan jejak yang
    // dapat disapu, bukan video yatim di penyedia.
    const { value, create, bunny } = service();

    const hasil = await value.siapkanUnggahan({ ownerId: 'pelajar-1', title: 'Klip', originalName: 'klip.mp4' });

    expect(bunny.createVideo).toHaveBeenCalledWith('Klip');
    expect(create.mock.calls[0][0].data).toMatchObject({
      createdBy: 'pelajar-1',
      provider: VideoProvider.BUNNY_STREAM,
      providerVideoId: 'bunny-1',
      status: VideoStatus.CREATED,
      originalName: 'klip.mp4',
    });
    expect(hasil).toEqual({ videoAssetId: 'aset-1', tiket: TIKET });
  });

  test('tidak mencatat aset apa pun bila penyedia menolak membuat video', async () => {
    const { value, create } = service({ createVideo: jest.fn().mockRejectedValue(new Error('Bunny down')) });

    await expect(value.siapkanUnggahan({ ownerId: 'p', title: 'K', originalName: 'k.mp4' })).rejects.toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });

  test('menyelaraskan aset yang sudah siap di penyedia menjadi AVAILABLE', async () => {
    const { value, update } = service();

    await expect(value.selaraskan('aset-1')).resolves.toBe('AVAILABLE');
    expect(update.mock.calls[0][0].data).toMatchObject({ status: VideoStatus.AVAILABLE });
  });

  test('menyelaraskan aset yang gagal di penyedia menjadi FAILED', async () => {
    const { value } = service({ fetchVideo: jest.fn().mockResolvedValue({ ready: false, failed: true, sizeBytes: null }) });

    await expect(value.selaraskan('aset-1')).resolves.toBe('FAILED');
  });

  test('aset yang masih diproses dibiarkan apa adanya tanpa menulis ke basis data', async () => {
    const { value, update } = service({ fetchVideo: jest.fn().mockResolvedValue({ ready: false, failed: false, sizeBytes: null }) });

    await expect(value.selaraskan('aset-1')).resolves.toBe('PROCESSING');
    expect(update).not.toHaveBeenCalled();
  });

  test('penyedia yang tidak dapat dihubungi tidak menjatuhkan pemanggilnya', async () => {
    // Pembaca lebih baik melihat "sedang diproses" daripada halaman yang gagal.
    const { value } = service({ fetchVideo: jest.fn().mockRejectedValue(new Error('jaringan')) });

    await expect(value.selaraskan('aset-1')).resolves.toBe('PROCESSING');
  });

  test('aset yang sudah terminal tidak menghubungi penyedia lagi', async () => {
    const { value, bunny } = service();
    (value as never as { prisma: { videoAsset: { findFirst: jest.Mock } } }).prisma.videoAsset.findFirst =
      jest.fn().mockResolvedValue({ id: 'aset-1', provider: VideoProvider.BUNNY_STREAM, providerVideoId: 'b', status: VideoStatus.AVAILABLE });

    await expect(value.selaraskan('aset-1')).resolves.toBe('AVAILABLE');
    expect(bunny.fetchVideo).not.toHaveBeenCalled();
  });
});
