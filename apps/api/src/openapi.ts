import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument, createApp } from './bootstrap';

/**
 * Menulis openapi.json tanpa menyalakan server.
 *
 * CI menjalankan skrip ini lalu memeriksa `git diff`, sehingga client yang
 * tertinggal dari kontrak akan menggagalkan build (ADR-009).
 */
async function main(): Promise<void> {
  const app = await createApp();

  // Metadata controller sudah tersedia setelah NestFactory.create().
  // Jangan memanggil app.init(): generator kontrak harus dapat berjalan di CI
  // tanpa PostgreSQL atau Redis.
  const document = buildOpenApiDocument(app);
  const target = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  process.stdout.write(`OpenAPI ditulis ke ${target}\n`);
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    process.stderr.write(`Gagal membuat OpenAPI: ${String(error)}\n`);
    process.exit(1);
  },
);
