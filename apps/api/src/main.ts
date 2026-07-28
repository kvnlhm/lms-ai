import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX, buildOpenApiDocument, createApp } from './bootstrap';
import { loadConfig } from './config/configuration';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createApp();

  // Dokumentasi interaktif hanya di luar produksi.
  if (config.env !== 'production') {
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app));
  }

  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`${config.appName} API berjalan di http://localhost:${config.port}/${API_PREFIX}`);
  if (config.env !== 'production') {
    logger.log(`Dokumentasi OpenAPI: http://localhost:${config.port}/${API_PREFIX}/docs`);
  }
}

void main();
