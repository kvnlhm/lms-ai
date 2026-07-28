import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/configuration';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { AppError } from '../../../shared/errors/app-error';

/**
 * Pembatas percobaan login per pasangan IP dan email.
 *
 * Email di-hash sebelum dijadikan bagian key supaya daftar email tidak dapat
 * dipanen dari Redis.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly app: AppConfig;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  private key(ip: string, email: string): string {
    const digest = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
    return `${this.app.redis.cachePrefix}login-attempt:${ip}:${digest}`;
  }

  async assertAllowed(ip: string, email: string): Promise<void> {
    const attempts = await this.redis.client.get(this.key(ip, email));
    if (attempts && Number.parseInt(attempts, 10) >= this.app.auth.rateLimitMax) {
      throw AppError.rateLimited();
    }
  }

  async recordFailure(ip: string, email: string): Promise<void> {
    const key = this.key(ip, email);
    const attempts = await this.redis.client.incr(key);
    if (attempts === 1) {
      await this.redis.client.expire(key, this.app.auth.rateLimitWindowSeconds);
    }
  }

  async reset(ip: string, email: string): Promise<void> {
    await this.redis.client.del(this.key(ip, email));
  }
}
