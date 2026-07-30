import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PermissionCode, RoleCode } from '@lms/contracts';
import { UserStatus } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import type { AuthenticatedUser } from '../domain/session';
import { LoginRateLimiter } from './login-rate-limiter';
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
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
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
    const mfaEnabled = isMaster ? await this.mfa.isEnabled(user.id) : false;

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
      pendingMfa: isMaster && mfaEnabled,
      mfaSetupRequired: isMaster && !mfaEnabled,
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
        requiresMfa: isMaster,
        mfaSetupRequired: isMaster && !mfaEnabled,
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

  async listDevices(userId: string): Promise<
    Array<{
      id: string;
      deviceName: string | null;
      lastUsedAt: Date;
      createdAt: Date;
      expiresAt: Date;
    }>
  > {
    return this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, deviceName: true, lastUsedAt: true, createdAt: true, expiresAt: true },
      orderBy: { lastUsedAt: 'desc' },
    });
  }
}
