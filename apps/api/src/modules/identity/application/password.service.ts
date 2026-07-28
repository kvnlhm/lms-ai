import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id dengan parameter yang cukup untuk akun web.
 * Verifikasi selalu dijalankan penuh, termasuk saat email tidak ditemukan,
 * supaya waktu respons tidak mengungkap keberadaan akun.
 */
@Injectable()
export class PasswordService {
  private static readonly OPTIONS = {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  /** Hash pembanding untuk email yang tidak ada, dibuat sekali saat startup. */
  private readonly dummyHash: Promise<string>;

  constructor() {
    this.dummyHash = hash('password-yang-tidak-akan-pernah-cocok', PasswordService.OPTIONS);
  }

  async hash(plain: string): Promise<string> {
    return hash(plain, PasswordService.OPTIONS);
  }

  async verify(passwordHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plain);
    } catch {
      return false;
    }
  }

  /** Membakar waktu yang setara dengan verifikasi asli. */
  async burn(plain: string): Promise<void> {
    await verify(await this.dummyHash, plain).catch(() => false);
  }
}
