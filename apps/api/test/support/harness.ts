import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { API_PREFIX, createApp } from '../../src/bootstrap';

export const prefix = `/${API_PREFIX}`;

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
export async function startHarness(): Promise<Harness> {
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
  const response = await request(server)
    .post(`${prefix}/auth/login`)
    .send({ email, password })
    .expect(200);

  const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
  if (!setCookie) throw new Error('Login tidak mengirim cookie.');

  const cookie = setCookie.map((entry) => entry.split(';')[0]).join('; ');
  const csrfRaw = setCookie.find((entry) => entry.startsWith('lms_csrf='));
  const csrfToken = decodeURIComponent(csrfRaw?.split(';')[0]?.split('=')[1] ?? '');

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
