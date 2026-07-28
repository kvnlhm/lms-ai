import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../../config/configuration';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService<{ app: AppConfig }, true>) {
    const app = config.get('app', { infer: true });
    // Koneksi dibuat saat command pertama dijalankan. Ini membuat proses
    // build/OpenAPI tidak bergantung pada Redis, sementara readiness tetap
    // memaksa koneksi melalui PING sebelum instance menerima trafik.
    this.client = new Redis(app.redis.url, { maxRetriesPerRequest: 3, lazyConnect: true });
    this.client.on('error', (error) => this.logger.error(`Redis error: ${error.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async ping(): Promise<boolean> {
    const reply = await this.client.ping();
    return reply === 'PONG';
  }
}
