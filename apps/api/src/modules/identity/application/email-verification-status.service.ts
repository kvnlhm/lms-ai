import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { EmailVerificationStatusPort } from '../../enrollment/application/email-verification.port';

/**
 * Jawaban identity atas pertanyaan "alamat emailnya sudah terbukti?".
 *
 * Akun yang lahir dari pembayaran sudah terbukti sejak awal — alamatnya yang
 * menerima tautan aktivasi. Yang perlu ditanyai hanyalah pendaftar gratis, dan
 * hanya ketika ia mencoba membuka materi contoh (ADR-032).
 */
@Injectable()
export class EmailVerificationStatusService implements EmailVerificationStatusPort {
  constructor(private readonly prisma: PrismaService) {}

  async emailSudahTerbukti(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { emailVerifiedAt: true },
    });
    return user?.emailVerifiedAt !== null && user?.emailVerifiedAt !== undefined;
  }
}
