import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { AppError } from '../../../shared/errors/app-error';

@Injectable()
export class CheckoutRateLimiter {
  private readonly prefix: string;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.prefix = config.get('app', { infer: true }).redis.cachePrefix;
  }

  async consume(ip: string, email: string): Promise<void> {
    const emailHash = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24);
    const key = `${this.prefix}checkout:${ip}:${emailHash}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, 900);
    if (count > 5) throw AppError.rateLimited();
  }
}

