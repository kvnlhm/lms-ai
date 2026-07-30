import { Injectable } from '@nestjs/common';
import { CredentialTokenPurpose } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { CredentialTokenService } from './credential-token.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

/**
 * Batas aplikasi untuk operasi credential lintas modul.
 *
 * Modul Users tidak boleh mengetahui bentuk hash, token persistence, MFA,
 * maupun key Redis session.
 */
@Injectable()
export class UserCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: CredentialTokenService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
  ) {}

  async hashUnusablePassword(): Promise<string> {
    return this.passwords.hash(randomBytes(48).toString('base64url'));
  }

  issueInvitation(userId: string) {
    return this.tokens.issue(userId, CredentialTokenPurpose.INVITATION);
  }

  issuePasswordReset(userId: string) {
    return this.tokens.issue(userId, CredentialTokenPurpose.PASSWORD_RESET);
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    const consumed = await this.tokens.consume(token, CredentialTokenPurpose.INVITATION);
    if (!consumed) throw AppError.tokenExpired();

    await this.prisma.user.update({
      where: { id: consumed.userId },
      data: {
        passwordHash: await this.passwords.hash(password),
        emailVerifiedAt: new Date(),
      },
    });
    await this.sessions.destroyAllForUser(consumed.userId);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const consumed = await this.tokens.consume(token, CredentialTokenPurpose.PASSWORD_RESET);
    if (!consumed) throw AppError.tokenExpired();

    await this.prisma.user.update({
      where: { id: consumed.userId },
      data: { passwordHash: await this.passwords.hash(password) },
    });
    await this.revokeSessions(consumed.userId);
  }

  async revokeSessions(userId: string): Promise<number> {
    const revoked = await this.sessions.destroyAllForUser(userId);
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return revoked;
  }

  async resetMfa(userId: string): Promise<void> {
    await this.mfa.reset(userId);
    await this.revokeSessions(userId);
  }
}
