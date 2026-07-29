import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { MfaMethodType } from '@prisma/client';
import * as OTPAuth from 'otpauth';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Autentikasi faktor kedua berbasis TOTP.
 *
 * Rahasia TOTP setara kata sandi permanen, jadi disimpan terenkripsi dengan
 * AES-256-GCM. Kuncinya berasal dari environment, bukan database, sehingga
 * bocornya dump saja tidak cukup untuk membangkitkan kode yang sah.
 */
@Injectable()
export class MfaService {
  private readonly app: AppConfig;
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
    this.key = Buffer.from(this.app.auth.mfaEncryptionKey, 'base64');

    if (this.key.length !== 32) {
      throw new Error('MFA_ENCRYPTION_KEY harus 32 byte dalam base64.');
    }
  }

  /**
   * Menyiapkan TOTP dan mengembalikan URI untuk dipindai aplikasi autentikator.
   * Rahasianya belum berlaku sampai dikonfirmasi lewat `confirm()`.
   */
  async beginSetup(userId: string, email: string): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = this.buildTotp(secret.base32, email);

    await this.prisma.mfaMethod.upsert({
      where: { userId_type: { userId, type: MfaMethodType.TOTP } },
      create: {
        userId,
        type: MfaMethodType.TOTP,
        encryptedSecret: this.encrypt(secret.base32),
        verifiedAt: null,
      },
      update: {
        encryptedSecret: this.encrypt(secret.base32),
        // Menyiapkan ulang membatalkan konfirmasi sebelumnya.
        verifiedAt: null,
      },
    });

    return { secret: secret.base32, otpauthUrl: totp.toString() };
  }

  /** Mengonfirmasi bahwa autentikator benar-benar menghasilkan kode yang cocok. */
  async confirm(userId: string, email: string, code: string): Promise<void> {
    const method = await this.prisma.mfaMethod.findUnique({
      where: { userId_type: { userId, type: MfaMethodType.TOTP } },
    });
    if (!method) throw AppError.notFound();

    if (!this.verifyCode(this.decrypt(method.encryptedSecret), email, code)) {
      throw new AppError('VALIDATION_ERROR', 422, 'Kode tidak cocok.', {
        code: ['Kode tidak cocok. Periksa jam perangkat lalu coba lagi.'],
      });
    }

    await this.prisma.mfaMethod.update({
      where: { id: method.id },
      data: { verifiedAt: new Date() },
    });
  }

  async isEnabled(userId: string): Promise<boolean> {
    const method = await this.prisma.mfaMethod.findFirst({
      where: { userId, type: MfaMethodType.TOTP, verifiedAt: { not: null } },
      select: { id: true },
    });
    return method !== null;
  }

  /** Memverifikasi kode saat login. */
  async verifyForLogin(userId: string, email: string, code: string): Promise<boolean> {
    const method = await this.prisma.mfaMethod.findFirst({
      where: { userId, type: MfaMethodType.TOTP, verifiedAt: { not: null } },
    });
    if (!method) return false;
    return this.verifyCode(this.decrypt(method.encryptedSecret), email, code);
  }

  /** Dipakai Master untuk memulihkan pengguna yang kehilangan perangkatnya. */
  async reset(userId: string): Promise<void> {
    await this.prisma.mfaMethod.deleteMany({ where: { userId } });
  }

  private buildTotp(secret: string, email: string): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      issuer: this.app.auth.mfaIssuer,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
  }

  private verifyCode(secret: string, email: string, code: string): boolean {
    // window: 1 memberi toleransi satu periode ke depan dan ke belakang,
    // menutupi jam perangkat yang sedikit meleset tanpa memperlebar celah.
    const delta = this.buildTotp(secret, email).validate({ token: code, window: 1 });
    return delta !== null;
  }

  private encrypt(plain: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

    // IV disimpan bersama ciphertext; nilainya tidak rahasia, hanya harus unik.
    // Disalin ke ArrayBuffer baru karena Buffer Node dapat menumpang memori
    // bersama, sedangkan kolom Bytes Prisma menuntut buffer yang dimiliki sendiri.
    const combined = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    const owned = new Uint8Array(new ArrayBuffer(combined.byteLength));
    owned.set(combined);
    return owned;
  }

  private decrypt(payload: Uint8Array): string {
    const buffer = Buffer.from(payload);
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
