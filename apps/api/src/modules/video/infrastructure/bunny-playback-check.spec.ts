import { Logger } from '@nestjs/common';
import { VideoProvider, VideoStatus } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BunnyPlaybackCheck } from './bunny-playback-check.service';

const CDN = 'vz-uji.b-cdn.net';
const GUID = 'ce6d8023-c87a-47e8-8678-4bb7d859817f';
const WEB_URL = 'https://akademi.uji';

interface Setelan {
  tokenAuthKey?: string;
  adaAset?: boolean;
}

/** Mengembalikan status per URL: bertanda tangan vs polos. */
function pasangResponse(bertandaTangan: number, polos: number) {
  return jest.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const status = url.includes('bcdn_token=') ? bertandaTangan : polos;
    return {
      status,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response;
  }) as unknown as jest.Mock<Promise<Response>, [string, RequestInit]> & typeof fetch;
}

function buat({ tokenAuthKey, adaAset = true }: Setelan) {
  const prisma = {
    videoAsset: {
      findFirst: jest.fn(async () =>
        adaAset
          ? { providerVideoId: GUID, provider: VideoProvider.BUNNY_STREAM, status: VideoStatus.AVAILABLE }
          : null,
      ),
    },
  } as unknown as PrismaService;

  const app = {
    webUrl: WEB_URL,
    video: { bunny: { cdnHostname: CDN, tokenAuthKey, startupCheckEnabled: true } },
  } as unknown as AppConfig;

  const config = { get: () => app } as unknown as ConfigService<{ app: AppConfig }, true>;
  return new BunnyPlaybackCheck(prisma, config);
}

describe('BunnyPlaybackCheck', () => {
  const asli = global.fetch;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = asli;
    jest.restoreAllMocks();
  });

  it('menyatakan sehat ketika URL bertanda tangan diterima CDN', async () => {
    global.fetch = pasangResponse(200, 403);
    await expect(buat({ tokenAuthKey: 'kunci' }).jalankan()).resolves.toBe('OK');
  });

  it('menyatakan sehat ketika library memang tanpa token dan URL polos diterima', async () => {
    global.fetch = pasangResponse(404, 200);
    await expect(buat({}).jalankan()).resolves.toBe('OK');
  });

  it('menangkap kunci terisi sementara token authentication belum aktif', async () => {
    // Justru inilah yang hampir lolos ke produksi: URL bertanda tangan dibaca
    // CDN sebagai nama folder yang tidak ada, sedangkan yang polos berhasil.
    global.fetch = pasangResponse(404, 200);
    const cek = buat({ tokenAuthKey: 'kunci' });
    const salah = jest.spyOn(Logger.prototype, 'error');

    await expect(cek.jalankan()).resolves.toBe('TIDAK_COCOK');
    expect(salah.mock.calls[0]?.[0]).toContain('belum aktif');
  });

  it('menangkap token authentication aktif sementara kunci kita kosong', async () => {
    global.fetch = pasangResponse(200, 403);
    const cek = buat({});
    const salah = jest.spyOn(Logger.prototype, 'error');

    await expect(cek.jalankan()).resolves.toBe('TIDAK_COCOK');
    expect(salah.mock.calls[0]?.[0]).toContain('BUNNY_STREAM_TOKEN_AUTH_KEY kosong');
  });

  it('tidak menuduh salah setelan ketika CDN sedang bermasalah', async () => {
    // 500 di kedua bentuk URL bukan ketidaksepakatan setelan, dan menyebutnya
    // begitu akan mengirim orang memperbaiki hal yang tidak rusak.
    global.fetch = pasangResponse(500, 500);
    await expect(buat({ tokenAuthKey: 'kunci' }).jalankan()).resolves.toBe('GAGAL');
  });

  it('dilewati selama belum ada video Bunny satu pun', async () => {
    const panggil = pasangResponse(200, 200);
    global.fetch = panggil;

    await expect(buat({ tokenAuthKey: 'kunci', adaAset: false }).jalankan()).resolves.toBe('LEWAT');
    expect(panggil).not.toHaveBeenCalled();
  });

  it('mengirim Referer agar pembatasan referrer tidak salah dibaca sebagai galat token', async () => {
    const panggil = pasangResponse(200, 200);
    global.fetch = panggil;

    await buat({ tokenAuthKey: 'kunci' }).jalankan();

    const [, init] = panggil.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Referer).toBe(WEB_URL);
  });

  it('tidak melempar ketika jaringan mati', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as unknown as typeof fetch;

    await expect(buat({ tokenAuthKey: 'kunci' }).jalankan()).resolves.toBe('GAGAL');
  });
});
