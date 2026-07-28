import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
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

  // Express mempercayai satu proxy di depan (nginx) agar request.ip benar
  // untuk rate limiting dan audit log.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  return app;
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('LMS API')
    .setDescription(
      'REST API LMS Akademi Online. Autentikasi memakai session opaque pada cookie HttpOnly; ' +
        'mutation memerlukan header X-CSRF-Token.',
    )
    .setVersion('1.0.0')
    .addCookieAuth('lms_session', { type: 'apiKey', in: 'cookie', name: 'lms_session' })
    .addServer(`/${API_PREFIX}`)
    .build();

  return SwaggerModule.createDocument(app, builder);
}
