import { CommunityAttachmentService } from './community-attachment.service';

/**
 * Menyiapkan lampiran video: aset dan izin unggah dibuat lebih dulu, lalu
 * peramban mengunggah langsung ke penyedia. Byte videonya tidak pernah melewati
 * VPS ini — itulah seluruh alasan memindahkannya.
 */
describe('CommunityAttachmentService.siapkanVideo', () => {
  const TIKET = { videoId: 'bunny-1', libraryId: '9', signature: 'tanda', expires: 1, endpoint: 'https://tus' };

  function service(overrides: { menggantung?: number; maxPerPost?: number } = {}) {
    const create = jest.fn().mockImplementation(({ data }) => ({
      id: 'lampiran-1', position: 0, createdAt: new Date('2026-08-08T00:00:00Z'),
      width: null, height: null, videoAsset: { status: 'CREATED', providerVideoId: 'bunny-1' },
      ...data,
    }));
    const prisma = {
      communityPostAttachment: {
        create,
        count: jest.fn().mockResolvedValue(overrides.menggantung ?? 0),
      },
    };
    const provisioner = {
      siapkanUnggahan: jest.fn().mockResolvedValue({ videoAssetId: 'aset-1', tiket: TIKET }),
      selaraskan: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue({
        communityAttachment: {
          storagePath: '/tmp', maxUploadBytes: 104857600,
          maxDraftUploadBytes: 10485760, maxPerPost: overrides.maxPerPost ?? 10,
        },
        video: { playbackTtlSeconds: 300, bunny: { cdnHostname: 'cdn', tokenAuthKey: 'k' } },
      }),
    };
    const value = new CommunityAttachmentService(
      prisma as never, config as never, { record: jest.fn() } as never, provisioner as never,
    );
    return { value, create, provisioner };
  }

  const masukan = { originalName: 'klip mudik.mp4', sizeBytes: 5_000_000 };

  test('mengembalikan izin unggah beserta lampiran drafnya', async () => {
    const { value, provisioner } = service();

    const hasil = await value.siapkanVideo('pelajar-1', masukan);

    expect(provisioner.siapkanUnggahan).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'pelajar-1', originalName: 'klip mudik.mp4' }),
    );
    expect(hasil.tiket).toEqual(TIKET);
    expect(hasil.attachment).toMatchObject({ id: 'lampiran-1', mimeType: 'video/mp4' });
  });

  test('lampiran video tidak memakai berkas lokal sama sekali', async () => {
    // Constraint `satu_sumber` di basis data menolak baris yang menunjuk
    // keduanya; ini menjaga sisi aplikasinya sejalan.
    const { value, create } = service();

    await value.siapkanVideo('pelajar-1', masukan);

    expect(create.mock.calls[0][0].data).toMatchObject({
      objectKey: null, videoAssetId: 'aset-1', postId: null, uploaderId: 'pelajar-1',
    });
  });

  test('nama berkas disanitasi seperti unggahan biasa', async () => {
    const { value, create } = service();

    await value.siapkanVideo('pelajar-1', { ...masukan, originalName: '../../rahasia.mp4' });

    expect(create.mock.calls[0][0].data.originalName).toBe('.._.._rahasia.mp4');
  });

  test('menolak ketika draf yang menggantung sudah mencapai batas', async () => {
    // Tanpa ini, membuka dan menutup composer berulang kali adalah cara
    // membuat video tanpa batas di library Bunny — dan itu berbiaya.
    const { value, provisioner } = service({ menggantung: 10, maxPerPost: 10 });

    await expect(value.siapkanVideo('pelajar-1', masukan)).rejects.toMatchObject({ status: 422 });
    expect(provisioner.siapkanUnggahan).not.toHaveBeenCalled();
  });

  test('menolak ukuran di atas batas sebelum menyentuh penyedia', async () => {
    const { value, provisioner } = service();

    await expect(value.siapkanVideo('pelajar-1', { ...masukan, sizeBytes: 10_485_761 }))
      .rejects.toMatchObject({ status: 422 });
    expect(provisioner.siapkanUnggahan).not.toHaveBeenCalled();
  });

  test('menolak ukuran nol atau negatif', async () => {
    const { value } = service();

    await expect(value.siapkanVideo('pelajar-1', { ...masukan, sizeBytes: 0 })).rejects.toMatchObject({ status: 422 });
  });
});
