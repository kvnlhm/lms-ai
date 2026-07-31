import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PermissionCode, RoleCode } from '@lms/contracts';
import { CredentialTokenPurpose, UserStatus } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { passwordResetEmail } from '../../../shared/email/email-templates';
import { EmailService } from '../../../shared/email/email.service';
import { AppError } from '../../../shared/errors/app-error';
import type { AuthenticatedUser } from '../domain/session';
import { CredentialTokenService } from './credential-token.service';
import { LoginRateLimiter } from './login-rate-limiter';
import { PasswordResetRateLimiter } from './password-reset-rate-limiter';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';

export interface LoginCommand {
  email: string;
  password: string;
  deviceName?: string;
  ipAddress: string;
  userAgent?: string;
}

export interface LoginResult {
  sessionId: string;
  csrfToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: RoleCode;
    status: UserStatus;
    requiresMfa: boolean;
    mfaSetupRequired: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly app: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly rateLimiter: LoginRateLimiter,
    private readonly mfa: MfaService,
    private readonly resetRateLimiter: PasswordResetRateLimiter,
    private readonly tokens: CredentialTokenService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  /**
   * Memulai pemulihan password atas permintaan pemilik akun.
   *
   * Pemanggilnya tidak pernah tahu apakah alamatnya terdaftar: seluruh cabang
   * di bawah berakhir tanpa nilai kembalian, dan controller selalu membalas
   * badan yang sama. Tanpa itu endpoint ini menjadi alat pemeriksa
   * keanggotaan — cukup coba satu alamat untuk tahu apakah orangnya murid di
   * sini.
   */
  async requestPasswordReset(command: { email: string; ipAddress: string }): Promise<void> {
    const email = command.email.trim().toLowerCase();
    await this.resetRateLimiter.consume(command.ipAddress, email);

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, status: UserStatus.ACTIVE },
      select: { id: true, fullName: true, email: true },
    });
    if (!user) return;

    const issued = await this.tokens.issue(user.id, CredentialTokenPurpose.PASSWORD_RESET);
    const resetUrl = `${this.app.webUrl}/reset-password?token=${encodeURIComponent(issued.token)}`;

    // Pengiriman sengaja tidak ditunggu. Panggilan ke provider memakan waktu
    // yang jelas berbeda dari cabang "akun tidak ada" di atas, dan selisih
    // waktu itu saja sudah cukup untuk menebak alamat mana yang terdaftar.
    this.email.sendInBackground(
      passwordResetEmail({
        to: user.email,
        fullName: user.fullName,
        resetUrl,
        expiresInMinutes: this.app.auth.passwordResetTtlMinutes,
      }),
      `pemulihan password untuk pengguna ${user.id}`,
    );

    await this.audit.record({
      actorUserId: user.id,
      action: 'user.password_reset_requested',
      targetType: 'user',
      targetId: user.id,
      ipAddress: command.ipAddress,
    });
  }

  async login(command: LoginCommand): Promise<LoginResult> {
    const email = command.email.trim().toLowerCase();
    await this.rateLimiter.assertAllowed(command.ipAddress, email);

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    // Email tidak ada: tetap jalankan verifikasi tiruan agar durasi respons
    // sama dengan kasus kata sandi salah.
    if (!user) {
      await this.passwords.burn(command.password);
      await this.rateLimiter.recordFailure(command.ipAddress, email);
      throw AppError.invalidCredentials();
    }

    const passwordValid = await this.passwords.verify(user.passwordHash, command.password);
    if (!passwordValid) {
      await this.rateLimiter.recordFailure(command.ipAddress, email);
      throw AppError.invalidCredentials();
    }

    // Status diperiksa setelah kata sandi benar, supaya status akun tidak
    // dapat disimpulkan hanya dengan menebak email.
    if (user.status === UserStatus.SUSPENDED) throw AppError.accountSuspended();
    if (user.status !== UserStatus.ACTIVE) throw AppError.accountInactive();

    const assignment = user.roles[0];
    if (!assignment) {
      this.logger.error(`Pengguna ${user.id} tidak memiliki role.`);
      throw AppError.accountInactive();
    }

    const roleCode = assignment.role.code as RoleCode;
    const permissions = assignment.role.permissions.map((rp) => rp.permission.code as PermissionCode);
    const isMaster = roleCode === 'MASTER';
    const requiresMasterMfa = isMaster && this.app.auth.requireMasterMfa;
    const mfaEnabled = requiresMasterMfa ? await this.mfa.isEnabled(user.id) : false;

    const expiresAt = new Date(Date.now() + this.app.session.absoluteTtlSeconds * 1000);
    const deviceRecord = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        deviceName: command.deviceName?.slice(0, 120) ?? null,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent?.slice(0, 400) ?? null,
        expiresAt,
      },
    });

    const { sessionId, csrfToken } = await this.sessions.create({
      userId: user.id,
      roleCode,
      permissions,
      deviceRecordId: deviceRecord.id,
      pendingMfa: requiresMasterMfa && mfaEnabled,
      mfaSetupRequired: requiresMasterMfa && !mfaEnabled,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.rateLimiter.reset(command.ipAddress, email);

    return {
      sessionId,
      csrfToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: roleCode,
        status: user.status,
        requiresMfa: requiresMasterMfa,
        mfaSetupRequired: requiresMasterMfa && !mfaEnabled,
      },
    };
  }

  async logout(sessionId: string, deviceRecordId: string): Promise<void> {
    await this.sessions.destroy(sessionId);
    await this.prisma.authSession.updateMany({
      where: { id: deviceRecordId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<number> {
    const revoked = await this.sessions.destroyAllForUser(userId);
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return revoked;
  }

  async currentUser(user: AuthenticatedUser): Promise<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    bio: string | null;
    avatarUrl: string | null;
    role: RoleCode;
    status: UserStatus;
    permissions: PermissionCode[];
    isImpersonating: boolean;
  }> {
    const record = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        bio: true,
        avatarUrl: true,
        status: true,
      },
    });
    if (!record) throw AppError.authenticationRequired();

    return {
      ...record,
      role: user.roleCode,
      permissions: user.permissions,
      isImpersonating: Boolean(user.impersonatedByUserId),
    };
  }

  async updateCurrentUser(
    user: AuthenticatedUser,
    input: { fullName?: string; phone?: string | null; bio?: string | null },
  ): Promise<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    bio: string | null;
    avatarUrl: string | null;
    role: RoleCode;
    status: UserStatus;
    permissions: PermissionCode[];
    isImpersonating: boolean;
  }> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.bio !== undefined ? { bio: input.bio?.trim() || null } : {}),
      },
    });
    return this.currentUser(user);
  }

  async listDevices(userId: string, currentDeviceRecordId: string): Promise<
    Array<{
      id: string;
      deviceName: string | null;
      isCurrent: boolean;
      lastUsedAt: Date;
      createdAt: Date;
      expiresAt: Date;
    }>
  > {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, deviceName: true, lastUsedAt: true, createdAt: true, expiresAt: true },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentDeviceRecordId,
    }));
  }
}
