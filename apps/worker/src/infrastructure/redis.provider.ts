import { Logger, type Provider } from '@nestjs/common';
import IORedis from 'ioredis';
import { loadWorkerConfig } from '../config';

export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

/**
 * Satu koneksi Redis dipakai bersama oleh relay dan seluruh worker BullMQ.
 *
 * `maxRetriesPerRequest: null` adalah syarat BullMQ: perintah blocking harus
 * boleh menunggu tanpa dibatalkan klien.
 */
export const redisProvider: Provider = {
  provide: REDIS_CONNECTION,
  useFactory: (): IORedis => {
    const config = loadWorkerConfig();
    const client = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    const logger = new Logger('Redis');
    client.on('error', (error) => logger.error(`Redis error: ${error.message}`));
    return client;
  },
};
