import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

export const API_PREFIX = 'api/v1';

/**
 * Konfigurasi aplikasi dipakai bersama oleh server, generator OpenAPI, dan
 * test end-to-end, supaya ketiganya tidak pernah berbeda perilaku.
 */
export async function createApp(): Promise<INestApplication> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());

  // Batas ukuran body, diwajibkan SECURITY_CONTROLS §3. Sebelumnya hanya
  // mengandalkan bawaan Express yang tidak pernah dinyatakan di mana pun,
  // sehingga tidak ada yang tahu berapa nilainya tanpa membaca dependensi.
  //
  // Unggahan video dan foto profil tidak terpengaruh: keduanya membaca body
  // sebagai stream dengan content-type non-JSON, jadi parser ini melewatinya
  // dan batas ukurannya diurus masing-masing modul.
  app.use(json({ limit: config.maxRequestBodyBytes }));
  app.use(urlencoded({ extended: false, limit: config.maxRequestBodyBytes }));

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
