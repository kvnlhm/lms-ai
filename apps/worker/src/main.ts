import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: false,
  });
  app.enableShutdownHooks();
  new Logger('Bootstrap').log('LMS worker berjalan.');
}

void main().catch((error: unknown) => {
  new Logger('Bootstrap').error(error);
  process.exitCode = 1;
});
