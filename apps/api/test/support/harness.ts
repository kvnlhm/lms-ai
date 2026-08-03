import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import request from 'supertest';
import * as OTPAuth from 'otpauth';
import type { App } from 'supertest/types';
import { API_PREFIX, createApp } from '../../src/bootstrap';

export const prefix = `/${API_PREFIX}`;

/** Rahasia aplikasi Meta versi uji, dipakai menandatangani webhook WhatsApp. */
export const WHATSAPP_APP_SECRET = 'rahasia-aplikasi-meta-untuk-pengujian';
/** Token yang dicocokkan saat Meta memasang URL webhook. */
export const WHATSAPP_VERIFY_TOKEN = 'token-verifikasi-webhook-uji';
/**
 * Rahasia penanda tangan webhook Resend versi uji.
 *
 * Berbentuk `whsec_<base64>` seperti aslinya, karena yang menjadi kunci HMAC
 * adalah hasil dekode base64-nya — bukan teksnya.
 */
export const RESEND_SIGNING_SECRET = 'whsec_cmFoYXNpYS13ZWJob29rLXJlc2VuZC11amk=';

export const BUNNY_CDN_HOSTNAME = 'vz-pengujian.b-cdn.net';
export const BUNNY_TOKEN_AUTH_KEY = 'kunci-penanda-tangan-untuk-pengujian';

export interface Harness {
  app: INestApplication;
  server: App;
  prisma: PrismaClient;
  redis: Redis;
  close: () => Promise<void>;
}

/**
 * Menyalakan aplikasi sungguhan dengan PostgreSQL dan Redis nyata.
 *
 * Transaksi, constraint unik, dan perilaku session adalah hal yang justru
 * ingin diuji di sini, jadi dependensi tidak digantikan test double.
 */
export interface HarnessOptions {
  /**
   * Menyalakan pembatas laju global dengan anggaran tertentu. Hanya spec yang
   * memang menguji pembatasnya yang memakai ini; sisanya berjalan tanpa
   * pembatas karena 235 test dari satu alamat pasti menabraknya.
   */
  rateLimit?: { max: number; windowSeconds: number };
}

export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  // Seluruh variabel di bawah ditulis tanpa syarat, bukan dengan `??=`.
  //
  // Jest memakai ulang satu proses untuk beberapa berkas spec, dan
  // `process.env` dimiliki proses — bukan berkas. Dengan `??=`, spec pembatas
  // laju yang menyalakan RATE_LIMIT_MAX=8 mewariskan angka itu ke setiap spec
  // yang kebetulan berjalan sesudahnya di worker yang sama, sehingga ratusan
  // test membalas 429. Hasilnya bergantung pada urutan penjadwalan jest:
  // hijau di satu mesin, merah di mesin lain, tanpa satu pun perubahan kode.
  process.env.ANNOUNCEMENT_SCHEDULER_ENABLED = 'false';
  // Ditulis tanpa syarat karena alasan yang sama: nilainya tetap di seluruh
  // spec, jadi endpoint webhook WhatsApp berperilaku sama di mana pun ia diuji.
  process.env.WHATSAPP_APP_SECRET = WHATSAPP_APP_SECRET;
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = WHATSAPP_VERIFY_TOKEN;
  process.env.RESEND_WEBHOOK_SIGNING_SECRET = RESEND_SIGNING_SECRET;
  // Bunny: hostname CDN dan kunci penanda tangan diset supaya jalur pemutaran
  // HLS dapat diuji tanpa menyentuh jaringan. API key sengaja dibiarkan kosong
  // — mendaftarkan video menuntut panggilan keluar ke Bunny, dan test tidak
  // boleh melakukannya; yang diuji adalah penolakannya saat belum dikonfigurasi.
  process.env.BUNNY_STREAM_CDN_HOSTNAME = BUNNY_CDN_HOSTNAME;
  process.env.BUNNY_STREAM_TOKEN_AUTH_KEY = BUNNY_TOKEN_AUTH_KEY;
  process.env.BUNNY_STREAM_LIBRARY_ID = '';
  process.env.BUNNY_STREAM_API_KEY = '';
  if (options.rateLimit) {
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_MAX = String(options.rateLimit.max);
    process.env.RATE_LIMIT_WINDOW_SECONDS = String(options.rateLimit.windowSeconds);
  } else {
    process.env.RATE_LIMIT_ENABLED = 'false';
  }

  const app = await createApp();
  await app.init();

  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  return {
    app,
    server: app.getHttpServer() as App,
    prisma,
    redis,
    close: async () => {
      await prisma.$disconnect();
      redis.disconnect();
      await app.close();
    },
  };
}

export interface Session {
  cookie: string;
  csrfToken: string;
  userId: string;
}

/** Masuk dan mengembalikan cookie beserta token CSRF untuk permintaan berikutnya. */
export async function login(
  server: App,
  email: string,
  password: string,
): Promise<Session> {
  // Setiap login Master dalam test memulai dari setup MFA yang bersih. Ini
  // membuat test saling independen sekaligus memastikan password saja tidak
  // pernah menghasilkan session administratif penuh.
  if (email === 'master@akademionline.id') {
    const setupPrisma = new PrismaClient();
    const master = await setupPrisma.user.findUnique({ where: { email }, select: { id: true } });
    if (master) await setupPrisma.mfaMethod.deleteMany({ where: { userId: master.id } });
    await setupPrisma.$disconnect();
  }

  const response = await request(server)
    .post(`${prefix}/auth/login`)
    .send({ email, password })
    .expect(200);

  const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
  if (!setCookie) throw new Error('Login tidak mengirim cookie.');

  let cookie = setCookie.map((entry) => entry.split(';')[0]).join('; ');
  const csrfRaw = setCookie.find((entry) => entry.startsWith('lms_csrf='));
  let csrfToken = decodeURIComponent(csrfRaw?.split(';')[0]?.split('=')[1] ?? '');

  if (response.body.data.user.mfaSetupRequired === true) {
    const setup = await request(server)
      .post(`${prefix}/auth/mfa/setup`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({})
      .expect(201);
    const secret = setup.body.data.secret as string;
    const code = new OTPAuth.TOTP({
      issuer: 'LMS Akademi Online',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    }).generate();
    const confirmed = await request(server)
      .post(`${prefix}/auth/mfa/setup/confirm`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ code })
      .expect(201);
    const rotated = confirmed.headers['set-cookie'] as unknown as string[];
    cookie = rotated.map((entry) => entry.split(';')[0]).join('; ');
    csrfToken = decodeURIComponent(
      rotated.find((entry) => entry.startsWith('lms_csrf='))?.split(';')[0]?.split('=')[1] ?? '',
    );
  }

  return { cookie, csrfToken, userId: response.body.data.user.id as string };
}

/** Pelajaran pertama pada kursus dengan slug tertentu, menurut urutan kurikulum. */
export async function firstLessonOf(prisma: PrismaClient, slug: string): Promise<string> {
  const lesson = await prisma.lesson.findFirstOrThrow({
    where: { module: { course: { slug } } },
    orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
    select: { id: true },
  });
  return lesson.id;
}
