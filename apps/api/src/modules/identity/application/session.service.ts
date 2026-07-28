import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../../config/configuration';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import type { SessionData } from '../domain/session';

/**
 * Penyimpanan session opaque di Redis (ADR-010).
 *
 * Session ID bersifat acak dan tidak membawa informasi apa pun; seluruh state
 * ada di server sehingga pencabutan cukup dengan menghapus key. Tidak ada JWT
 * dan tidak ada state autentikasi yang disimpan di browser selain cookie
 * opaque yang tidak dapat dibaca JavaScript.
 */
@Injectable()
export class SessionService {
  private readonly app: AppConfig;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  private key(sessionId: string): string {
    return `${this.app.redis.sessionPrefix}${sessionId}`;
  }

  private userIndexKey(userId: string): string {
    return `${this.app.redis.sessionPrefix}user:${userId}`;
  }

  /** 32 byte acak; cukup untuk membuat tebakan tidak praktis. */
  static generateId(): string {
    return randomBytes(32).toString('base64url');
  }

  static generateCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async create(
    data: Omit<SessionData, 'csrfToken' | 'absoluteExpiresAt' | 'createdAt'>,
  ): Promise<{ sessionId: string; csrfToken: string; absoluteExpiresAt: Date }> {
    const sessionId = SessionService.generateId();
    const csrfToken = SessionService.generateCsrfToken();
    const now = Date.now();
    const absoluteExpiresAt = now + this.app.session.absoluteTtlSeconds * 1000;

    const session: SessionData = {
      ...data,
      csrfToken,
      absoluteExpiresAt,
      createdAt: now,
    };

    const pipeline = this.redis.client.multi();
    pipeline.set(this.key(sessionId), JSON.stringify(session), 'EX', this.app.session.idleTtlSeconds);
    pipeline.sadd(this.userIndexKey(data.userId), sessionId);
    pipeline.expire(this.userIndexKey(data.userId), this.app.session.absoluteTtlSeconds);
    await pipeline.exec();

    return { sessionId, csrfToken, absoluteExpiresAt: new Date(absoluteExpiresAt) };
  }

  /**
   * Mengambil session dan memperpanjang idle TTL-nya.
   * Session yang melewati batas absolut dihapus dan dianggap tidak ada.
   */
  async touch(sessionId: string): Promise<SessionData | null> {
    const raw = await this.redis.client.get(this.key(sessionId));
    if (!raw) return null;

    let session: SessionData;
    try {
      session = JSON.parse(raw) as SessionData;
    } catch {
      await this.destroy(sessionId);
      return null;
    }

    if (Date.now() >= session.absoluteExpiresAt) {
      await this.destroy(sessionId);
      return null;
    }

    await this.redis.client.expire(this.key(sessionId), this.app.session.idleTtlSeconds);
    return session;
  }

  async destroy(sessionId: string): Promise<void> {
    const raw = await this.redis.client.get(this.key(sessionId));
    if (raw) {
      try {
        const session = JSON.parse(raw) as SessionData;
        await this.redis.client.srem(this.userIndexKey(session.userId), sessionId);
      } catch {
        // Payload rusak; hapus saja key-nya.
      }
    }
    await this.redis.client.del(this.key(sessionId));
  }

  /** Dipakai oleh logout-all dan pencabutan session oleh Master. */
  async destroyAllForUser(userId: string): Promise<number> {
    const sessionIds = await this.redis.client.smembers(this.userIndexKey(userId));
    if (sessionIds.length === 0) return 0;

    const pipeline = this.redis.client.multi();
    for (const id of sessionIds) pipeline.del(this.key(id));
    pipeline.del(this.userIndexKey(userId));
    await pipeline.exec();
    return sessionIds.length;
  }

  /** Perbandingan waktu-konstan supaya tidak membocorkan token lewat timing. */
  static csrfMatches(expected: string, received: string | undefined): boolean {
    if (!received) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
