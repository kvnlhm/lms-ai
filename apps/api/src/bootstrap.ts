import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

export const API_PREFIX = 'api/v1';

/** Jalur yang tanda tangannya dihitung atas byte mentah badan permintaan. */
const JALUR_BERTANDA_TANGAN = ['/webhooks/whatsapp', '/webhooks/resend'];

/**
 * Konfigurasi aplikasi dipakai bersama oleh server, generator OpenAPI, dan
 * test end-to-end, supaya ketiganya tidak pernah berbeda perilaku.
 */
export async function createApp(): Promise<INestApplication> {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());

  // Batas ukuran body, diwajibkan SECURITY_CONTROLS §3. Sebelumnya hanya
  // mengandalkan bawaan Express yang tidak pernah dinyatakan di mana pun,
  // sehingga tidak ada yang tahu berapa nilainya tanpa membaca dependensi.
  //
  // Lewat adapter Nest, bukan `import { json } from 'express'`: express hanya
  // dependency transitif lewat @nestjs/platform-express, dan pada image
  // produksi dengan layout pnpm ketat modulnya tidak terjangkau dari paket ini.
  // Impor langsung lolos typecheck di mesin pengembangan — tempat node_modules
  // ter-hoist — lalu gagal saat runtime di produksi.
  //
  // Unggahan video dan foto profil tidak terpengaruh: keduanya membaca body
  // sebagai stream dengan content-type non-JSON, jadi parser ini melewatinya
  // dan batas ukurannya diurus masing-masing modul.
  //
  // Webhook WhatsApp dan Resend sama-sama ditandatangani atas **byte mentah**
  // badannya, jadi byte itu harus disimpan sebelum diurai — `JSON.stringify`
  // dari objek hasil urai menghasilkan susunan yang berbeda dan tanda
  // tangannya tidak pernah cocok. Disimpan hanya untuk kedua jalur itu:
  // menahan salinan mentah setiap permintaan JSON hanya menggandakan pemakaian
  // memori tanpa guna.
  app.useBodyParser('json', {
    limit: config.maxRequestBodyBytes,
    verify: (
      request: IncomingMessage & { rawBody?: Buffer },
      _response: ServerResponse,
      buffer: Buffer,
    ) => {
      if (JALUR_BERTANDA_TANGAN.some((jalur) => request.url?.includes(jalur))) {
        request.rawBody = Buffer.from(buffer);
      }
    },
  });
  app.useBodyParser('urlencoded', { extended: false, limit: config.maxRequestBodyBytes });

  // Cookie session hanya berguna bila browser mengirimnya; origin web
  // ditetapkan eksplisit karena credentials tidak boleh dipakai dengan '*'.
  app.enableCors({
    origin: [config.webUrl],
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // 422 sesuai kontrak untuk kegagalan validasi field.
      errorHttpStatusCode: 422,
    }),
  );

  // Ada dua proxy di depan API, bukan satu: Traefik lalu gateway nginx.
  // Dengan nilai 1, `request.ip` berhenti pada alamat Traefik, sehingga setiap
  // audit log mencatat IP proxy yang sama dan pembatas laju per-IP kehilangan
  // daya bedanya — semua pengunjung masuk ke ember yang sama.
  //
  // Menaikkannya ke 2 aman karena Traefik menimpa X-Forwarded-For milik
  // klien, bukan menambahkannya: permintaan dengan header palsu terbukti
  // tetap tercatat sebagai alamat aslinya, sehingga tidak ada entri tambahan
  // yang bisa disisipkan untuk menggeser hitungan hop ini.
  app.getHttpAdapter().getInstance().set('trust proxy', 2);

  return app;
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('LMS API')
    .setDescription(
      'REST API LMS AIPreneur. Autentikasi memakai session opaque pada cookie HttpOnly; ' +
        'mutation memerlukan header X-CSRF-Token.',
    )
    .setVersion('1.0.0')
    .addCookieAuth('lms_session', { type: 'apiKey', in: 'cookie', name: 'lms_session' })
    .addServer(`/${API_PREFIX}`)
    .build();

  return SwaggerModule.createDocument(app, builder);
}
