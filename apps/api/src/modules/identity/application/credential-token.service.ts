import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { CredentialTokenPurpose } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export interface IssuedToken {
  /** Nilai mentah; hanya ada di memori dan dikirim sekali lewat tautan. */
  token: string;
  expiresAt: Date;
}

/**
 * Token sekali pakai untuk undangan akun dan pemulihan kata sandi.
 *
 * Yang disimpan hanya SHA-256 dari token. Dump database tidak cukup untuk
 * mengambil alih akun, karena nilai aslinya tidak pernah ada di sana.
 * SHA-256 memadai di sini — berbeda dari kata sandi, token ini 32 byte acak
 * sehingga tidak dapat ditebak dengan brute force.
 */
@Injectable()
export class CredentialTokenService {
  private readonly app: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(
    userId: string,
    purpose: CredentialTokenPurpose,
    ttlMinutes?: number,
  ): Promise<IssuedToken> {
    const minutes = ttlMinutes ?? this.defaultTtl(purpose);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + minutes * 60_000);

    // Token lama untuk keperluan yang sama dibatalkan: mengirim undangan baru
    // harus membuat tautan sebelumnya tidak berlaku.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.passwordResetToken.create({
      data: { userId, purpose, tokenHash: CredentialTokenService.hash(token), expiresAt },
    });

    return { token, expiresAt };
  }

  /**
   * Menukar token dengan pemiliknya, sekaligus menandainya terpakai.
   *
   * Penandaan memakai `updateMany` dengan syarat `usedAt: null`, sehingga dua
   * permintaan bersamaan hanya menghasilkan satu yang berhasil.
   */
  async consume(
    token: string,
    purpose: CredentialTokenPurpose,
  ): Promise<{ userId: string } | null> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: CredentialTokenService.hash(token) },
      select: { id: true, userId: true, purpose: true, expiresAt: true, usedAt: true },
    });

    if (!record) return null;
    if (record.purpose !== purpose) return null;
    if (record.usedAt !== null) return null;
    if (record.expiresAt <= new Date()) return null;

    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;

    return { userId: record.userId };
  }

  private defaultTtl(purpose: CredentialTokenPurpose): number {
    // Undangan berlaku jauh lebih lama karena penerimanya belum tentu langsung
    // membuka email; pemulihan kata sandi sengaja pendek.
    return purpose === CredentialTokenPurpose.INVITATION
      ? 7 * 24 * 60
      : this.app.auth.passwordResetTtlMinutes;
  }

  /** Perbandingan waktu-konstan untuk nilai rahasia pendek. */
  static matches(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return timingSafeEqual(bufferA, bufferB);
  }
}
