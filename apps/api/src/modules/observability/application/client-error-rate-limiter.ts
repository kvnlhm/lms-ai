import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/configuration';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { AppError } from '../../../shared/errors/app-error';

/**
 * Pagar untuk endpoint laporan galat browser.
 *
 * Endpointnya publik, jadi siapa pun dapat menulis ke tabel galat. Tanpa
 * pembatas, satu skrip cukup untuk menggelembungkan tabel dan — karena setiap
 * pesan yang dikarang menghasilkan fingerprint baru — memicu peringatan
 * berulang kali. Anggaran surat per jam menahan sisi surat; ini menahan sisi
 * penyimpanan.
 */
@Injectable()
export class ClientErrorRateLimiter {
  private readonly app: AppConfig;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  async consume(ip: string): Promise<void> {
    const digest = createHash('sha256').update(ip).digest('hex').slice(0, 32);
    const hour = Math.floor(Date.now() / 3_600_000);
    const key = `${this.app.redis.cachePrefix}client-error:${digest}:${hour}`;

    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, 3_600);
    if (count > this.app.observability.clientReportMaxPerHour) throw AppError.rateLimited();
  }
}
