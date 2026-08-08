import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialTokenPurpose, UserStatus } from '@prisma/client';
import { ROLES } from '@lms/contracts';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { EmailService } from '../../../shared/email/email.service';
import { emailVerificationEmail } from '../../../shared/email/email-templates';
import { AppError } from '../../../shared/errors/app-error';
import { CredentialTokenService } from './credential-token.service';
import { PasswordResetRateLimiter } from './password-reset-rate-limiter';
import { PasswordService } from './password.service';

export interface DaftarGratisInput {
  fullName: string;
  email: string;
  password: string;
  ipAddress: string;
}

/**
 * Pendaftaran mandiri tanpa pembayaran.
 *
 * Sengaja **tidak** menempuh alur checkout, bahkan tidak lewat paket berharga
 * nol. Paket Rp 0 akan melahirkan `RegistrationOrder` berstatus `PAID`, dan
 * pesanan `PAID` itulah definisi anggota berbayar (ADR-032) — jadi jalan yang
 * tampak paling mudah itu justru membatalkan seluruh penegakan hak akses.
 *
 * Yang dibuat di sini hanya akun: tanpa pesanan, tanpa grant, tanpa enrollment.
 */
@Injectable()
export class FreeRegistrationService {
  private readonly app: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: CredentialTokenService,
    private readonly email: EmailService,
    private readonly rateLimiter: PasswordResetRateLimiter,
    private readonly audit: AuditService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  /**
   * Balasannya selalu sama, terdaftar atau tidak.
   *
   * Membedakannya mengubah formulir pendaftaran menjadi alat memeriksa siapa
   * saja yang punya akun di sini — persis alasan `forgot-password` juga selalu
   * menjawab hal yang sama.
   */
  async daftar(input: DaftarGratisInput): Promise<{ registered: true }> {
    const email = input.email.trim().toLowerCase();
    await this.rateLimiter.consume(input.ipAddress, email);

    const adaSebelumnya = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, fullName: true, status: true, emailVerifiedAt: true },
    });

    if (adaSebelumnya) {
      // Alamat yang sudah terbukti dibiarkan tanpa kiriman apa pun: pemiliknya
      // sudah punya akun, dan mengirim tautan verifikasi ke sana hanya akan
      // membingungkan. Yang belum terbukti justru ditolong — orang mendaftar
      // dua kali biasanya karena email pertamanya tidak pernah sampai.
      if (!adaSebelumnya.emailVerifiedAt && adaSebelumnya.status === UserStatus.ACTIVE) {
        await this.kirimTautan(adaSebelumnya.id, email, adaSebelumnya.fullName);
      }
      return { registered: true };
    }

    const student = await this.prisma.role.findUnique({ where: { code: ROLES.STUDENT } });
    if (!student) throw AppError.notFound();

    const passwordHash = await this.passwords.hash(input.password);
    const dibuat = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: input.fullName.trim(),
          passwordHash,
          status: UserStatus.ACTIVE,
          // Kosong sampai tautannya dibuka. Akunnya sudah dapat dipakai masuk,
          // tetapi materi contoh menuntut alamat yang terbukti.
          emailVerifiedAt: null,
        },
        select: { id: true, fullName: true },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: student.id } });
      return user;
    });

    await this.kirimTautan(dibuat.id, email, dibuat.fullName);
    await this.audit.record({
      actorUserId: dibuat.id,
      action: 'user.registered_free',
      targetType: 'user',
      targetId: dibuat.id,
      ipAddress: input.ipAddress,
    });

    return { registered: true };
  }

  /** Menukar token dengan bukti bahwa alamatnya memang dimiliki pendaftarnya. */
  async verifikasi(token: string): Promise<{ verified: true }> {
    const klaim = await this.tokens.consume(token, CredentialTokenPurpose.EMAIL_VERIFICATION);
    if (!klaim) throw AppError.tokenExpired();

    await this.prisma.user.update({
      where: { id: klaim.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { verified: true };
  }

  private async kirimTautan(userId: string, email: string, fullName: string): Promise<void> {
    const issued = await this.tokens.issue(userId, CredentialTokenPurpose.EMAIL_VERIFICATION);
    const verifyUrl = `${this.app.webUrl}/verifikasi-email?token=${encodeURIComponent(issued.token)}`;
    await this.email.send(emailVerificationEmail({ to: email, fullName, verifyUrl }));
  }
}
