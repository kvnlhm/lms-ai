import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/configuration';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../errors/app-error';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
  SKIP_RATE_LIMIT_KEY,
} from './rate-limit.decorator';

/**
 * Pembatas laju yang berlaku untuk seluruh API.
 *
 * Sebelumnya hanya empat alur yang punya pembatas — login, pemulihan password,
 * checkout, dan laporan galat browser. Semua endpoint lain terbuka tanpa batas,
 * padahal `SECURITY_CONTROLS.md` §5 mewajibkan rate limiting untuk API.
 * Beberapa di antaranya mahal: satu permintaan pencarian global menjalankan
 * lima kueri sekaligus, dan daftar apa pun dapat dipaksa memindai tabel.
 *
 * Dipasang paling depan di antara guard sehingga ikut melindungi jalur
 * autentikasi itu sendiri — pembatas yang baru bekerja setelah sesi diperiksa
 * tidak menolong ketika yang dibanjiri justru halaman login.
 *
 * Pembatas per-alur yang sudah ada tetap dipertahankan: ini pagar kasar
 * terhadap banjir, sedangkan yang itu pagar semantik yang jauh lebih ketat.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly app: AppConfig;

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.app.rateLimit.enabled) return true;
    if (context.getType() !== 'http') return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const override = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const limit = override?.limit ?? this.app.rateLimit.max;
    const windowSeconds = override?.windowSeconds ?? this.app.rateLimit.windowSeconds;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Anggaran terpisah per endpoint yang punya batas sendiri, supaya
    // pencarian yang mahal tidak menghabiskan jatah menjelajah biasa.
    const scope = override ? `${request.method}:${context.getHandler().name}` : 'global';
    const key = this.keyFor(request, scope, windowSeconds);

    let used: number;
    try {
      used = await this.redis.client.incr(key);
      if (used === 1) await this.redis.client.expire(key, windowSeconds);
    } catch (error) {
      // Redis tidak terjangkau tidak boleh menutup seluruh situs. Membuka pintu
      // di sini adalah pilihan sadar: kehilangan pembatas laju sesaat lebih
      // ringan daripada seluruh akademi berhenti melayani.
      this.logger.error(
        `Pembatas laju dilewati karena Redis gagal: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return true;
    }

    const remaining = Math.max(0, limit - used);
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', remaining);

    if (used > limit) {
      response.setHeader('Retry-After', windowSeconds);
      throw AppError.rateLimited();
    }
    return true;
  }

  /**
   * Kunci per alamat, bukan per pengguna.
   *
   * Guard ini berjalan sebelum sesi diperiksa, jadi identitas pengguna memang
   * belum diketahui. Alamatnya di-hash agar daftar IP pengunjung tidak dapat
   * dipanen dari Redis, mengikuti pola pembatas yang sudah ada.
   */
  private keyFor(request: Request, scope: string, windowSeconds: number): string {
    const digest = createHash('sha256').update(request.ip ?? 'unknown').digest('hex').slice(0, 32);
    const bucket = Math.floor(Date.now() / (windowSeconds * 1_000));
    return `${this.app.redis.cachePrefix}ratelimit:${scope}:${digest}:${bucket}`;
  }
}
