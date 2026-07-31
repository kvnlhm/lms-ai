import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/configuration';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { AppError } from '../../../shared/errors/app-error';

/**
 * Pembatas permintaan pemulihan password.
 *
 * Berbeda dari LoginRateLimiter yang hanya menghitung percobaan gagal:
 * di sini setiap permintaan dihitung, karena jawabannya sengaja selalu sama
 * sehingga tidak ada sinyal "gagal" yang bisa dijadikan patokan. Tanpa itu
 * endpoint ini bisa dipakai membanjiri kotak masuk seseorang.
 *
 * Email di-hash sebelum masuk key agar daftar email tidak dapat dipanen dari
 * Redis, mengikuti pola yang sama dengan pembatas login.
 */
@Injectable()
export class PasswordResetRateLimiter {
  private readonly app: AppConfig;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  private key(scope: string, value: string): string {
    const digest = createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 32);
    return `${this.app.redis.cachePrefix}password-reset:${scope}:${digest}`;
  }

  /**
   * Dua pagar sekaligus. Pagar alamat mencegah satu kotak masuk dibanjiri
   * meski penyerang berganti-ganti IP; pagar IP mencegah satu sumber memindai
   * banyak alamat sekaligus.
   */
  async consume(ip: string, email: string): Promise<void> {
    const perEmail = await this.hit(this.key('email', email), this.app.auth.rateLimitMax);
    const perIp = await this.hit(this.key('ip', ip), this.app.auth.rateLimitMax * 3);
    if (!perEmail || !perIp) throw AppError.rateLimited();
  }

  private async hit(key: string, limit: number): Promise<boolean> {
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, this.app.auth.rateLimitWindowSeconds);
    }
    return count <= limit;
  }
}
