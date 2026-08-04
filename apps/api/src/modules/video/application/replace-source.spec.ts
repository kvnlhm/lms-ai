import { createHash } from 'node:crypto';
import { VideoProvider, VideoStatus } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';
import { BunnyStreamClient } from '../infrastructure/bunny-stream.client';
import { VideoService, bunnyPlaylistUrl, bunnySignedUrl } from './video.service';

const CDN = 'vz-uji.b-cdn.net';
const KUNCI = 'kunci-penanda-tangan-untuk-pengujian';
const GUID_LAMA = 'aaaaaaaa-1111-4111-8111-111111111111';
const GUID_BARU = 'bbbbbbbb-2222-4222-8222-222222222222';

const rm = jest.fn();
jest.mock('node:fs/promises', () => ({
  ...jest.requireActual<object>('node:fs/promises'),
  rm: (...args: unknown[]) => rm(...args),
}));

interface Setelan {
  provider?: VideoProvider;
  objectKey?: string | null;
  status?: VideoStatus;
  lessons?: number;
  ready?: boolean;
  failed?: boolean;
}

function buat({
  provider = VideoProvider.SELF_HOSTED,
  objectKey = 'video-lama.mp4',
  status = VideoStatus.AVAILABLE,
  lessons = 3,
  ready = true,
  failed = false,
}: Setelan = {}) {
  const update = jest.fn().mockResolvedValue({});
  const prisma = {
    videoAsset: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'aset-1',
        provider,
        providerVideoId: GUID_LAMA,
        objectKey,
        status,
        _count: { lessons },
      }),
      update,
    },
  } as unknown as PrismaService;

  const bunny = {
    fetchVideo: jest.fn().mockResolvedValue({ title: 'Judul Bunny', sizeBytes: 12345, ready, failed }),
  } as unknown as BunnyStreamClient;

  const app = {
    video: {
      storagePath: '/data/video',
      playbackTtlSeconds: 3600,
      bunny: { cdnHostname: CDN, tokenAuthKey: KUNCI },
    },
  } as unknown as AppConfig;
  const config = { get: () => app } as unknown as ConfigService<{ app: AppConfig }, true>;

  const service = new VideoService(prisma, {} as EnrollmentAccessService, bunny, config);
  return { service, prisma, bunny, update };
}

describe('bunnySignedUrl', () => {
  it('menandatangani sampul dengan token yang sama seperti playlist-nya', () => {
    // Token Bunny menandatangani direktori, bukan berkas. Kalau sampul dan
    // playlist sampai memakai token berbeda, salah satunya pasti 403 — dan
    // yang gagal diam-diam adalah sampulnya, di seluruh daftar perpustakaan.
    const kedaluwarsa = new Date(1_800_000_000_000);
    const playlist = bunnyPlaylistUrl({ cdnHostname: CDN, tokenAuthKey: KUNCI }, GUID_BARU, kedaluwarsa);
    const sampul = bunnySignedUrl(
      { cdnHostname: CDN, tokenAuthKey: KUNCI },
      GUID_BARU,
      'thumbnail.jpg',
      kedaluwarsa,
    );

    const token = (url: string) => /bcdn_token=([^&]+)/.exec(url)?.[1];
    expect(token(playlist!)).toBe(token(sampul!));
    expect(sampul).toContain(`/${GUID_BARU}/thumbnail.jpg`);
  });

  it('tidak menandatangani apa pun ketika kunci tidak disetel', () => {
    const polos = bunnySignedUrl({ cdnHostname: CDN }, GUID_BARU, 'thumbnail.jpg', new Date());
    expect(polos).toBe(`https://${CDN}/${GUID_BARU}/thumbnail.jpg`);
  });
});

describe('BunnyStreamClient.uploadTicket', () => {
  it('memakai rumus tanda tangan yang ditentukan Bunny', () => {
    const app = {
      video: { bunny: { libraryId: '720002', apiKey: 'rahasia-api' } },
    } as unknown as AppConfig;
    const client = new BunnyStreamClient({
      get: () => app,
    } as unknown as ConfigService<{ app: AppConfig }, true>);

    const tiket = client.uploadTicket(GUID_BARU);

    // Kunci API ikut masuk ke dalam hash tetapi tidak boleh ikut keluar; kalau
    // ia sampai ke peramban, seluruh library ikut terbuka.
    expect(tiket.signature).toBe(
      createHash('sha256').update(`720002rahasia-api${tiket.expires}${GUID_BARU}`).digest('hex'),
    );
    expect(JSON.stringify(tiket)).not.toContain('rahasia-api');
    expect(tiket.expires * 1000).toBeGreaterThan(Date.now());
  });
});

describe('VideoService.replaceAssetSource', () => {
  beforeEach(() => rm.mockReset());

  it('memindahkan aset ke Bunny dan melepas kunci berkas lamanya', async () => {
    const { service, update } = buat();

    const hasil = await service.replaceAssetSource('aset-1', { source: GUID_BARU });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: VideoProvider.BUNNY_STREAM,
          providerVideoId: GUID_BARU,
          // Berkasnya tidak lagi di server kita; kunci yang tertinggal akan
          // membuat pemutaran mencari berkas yang tidak pernah ada.
          objectKey: null,
          status: VideoStatus.AVAILABLE,
        }),
      }),
    );
    expect(hasil.affectedLessons).toBe(3);
    expect(hasil.localFileDeleted).toBe(false);
  });

  it('tidak menghapus berkas lama kecuali diminta', async () => {
    const { service } = buat();
    await service.replaceAssetSource('aset-1', { source: GUID_BARU });
    expect(rm).not.toHaveBeenCalled();
  });

  it('menghapus berkas lama bila diminta, dan hanya setelah database berpindah', async () => {
    const { service, update } = buat();

    const hasil = await service.replaceAssetSource('aset-1', {
      source: GUID_BARU,
      deleteLocalFile: true,
    });

    expect(rm).toHaveBeenCalledWith('/data/video/video-lama.mp4', { force: true });
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(rm.mock.invocationCallOrder[0]);
    expect(hasil.previousObjectKey).toBe('video-lama.mp4');
    expect(hasil.localFileDeleted).toBe(true);
  });

  it('tidak menghapus apa pun ketika asetnya memang tidak punya berkas lokal', async () => {
    const { service } = buat({ provider: VideoProvider.YOUTUBE, objectKey: null });
    const hasil = await service.replaceAssetSource('aset-1', {
      source: GUID_BARU,
      deleteLocalFile: true,
    });
    expect(rm).not.toHaveBeenCalled();
    expect(hasil.localFileDeleted).toBe(false);
  });

  it('menolak video yang gagal diproses Bunny sebelum menyentuh apa pun', async () => {
    const { service, update } = buat({ ready: false, failed: true });

    await expect(
      service.replaceAssetSource('aset-1', { source: GUID_BARU, deleteLocalFile: true }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(update).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalled();
  });

  it('menolak penggantian selagi unggahan aset itu masih berjalan', async () => {
    const { service, update } = buat({ status: VideoStatus.UPLOADING });
    await expect(
      service.replaceAssetSource('aset-1', { source: GUID_BARU }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(update).not.toHaveBeenCalled();
  });

  it('menolak mengganti aset Bunny dengan video Bunny yang sama', async () => {
    const { service, update } = buat({ provider: VideoProvider.BUNNY_STREAM, objectKey: null });
    await expect(
      service.replaceAssetSource('aset-1', { source: GUID_LAMA }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(update).not.toHaveBeenCalled();
  });

  it('menandai PROCESSING ketika Bunny belum selesai mengolahnya', async () => {
    // Aset boleh menunjuk video yang masih diproses, tetapi menyebutnya siap
    // akan membuat pelajar membuka pelajaran yang videonya tidak jalan.
    const { service } = buat({ ready: false });
    const hasil = await service.replaceAssetSource('aset-1', { source: GUID_BARU });
    expect(hasil.status).toBe(VideoStatus.PROCESSING);
  });
});
