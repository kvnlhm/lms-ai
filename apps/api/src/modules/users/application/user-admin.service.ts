import { Injectable } from '@nestjs/common';
import { MfaMethodType, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { UserCredentialService } from '../../identity/application/user-credential.service';
import { AppError } from '../../../shared/errors/app-error';
import { SessionService } from '../../identity/application/session.service';
import type { ActiveSession } from '../../identity/domain/session';

export interface ListUsersInput {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus;
  role?: 'MASTER' | 'STUDENT';
}

@Injectable()
export class UserAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: UserCredentialService,
    private readonly sessions: SessionService,
  ) {}

  async list(input: ListUsersInput) {
    const search = input.search?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.role ? { roles: { some: { role: { code: input.role } } } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { select: { role: { select: { code: true } } }, take: 1 },
          // Hanya metode yang sudah terverifikasi yang berarti MFA menyala —
          // sama persis dengan syarat yang dipakai saat login, supaya daftar
          // ini tidak menyebut "aktif" untuk pendaftaran yang tak pernah
          // diselesaikan.
          mfaMethods: {
            where: { type: MfaMethodType.TOTP, verifiedAt: { not: null } },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      total,
      items: items.map(({ roles, mfaMethods, ...user }) => ({
        ...user,
        role: (roles[0]?.role.code ?? 'STUDENT') as 'MASTER' | 'STUDENT',
        mfaEnabled: mfaMethods.length > 0,
      })),
    };
  }

  async create(input: {
    fullName: string;
    email: string;
    phone?: string | null;
    role: 'MASTER' | 'STUDENT';
    status: UserStatus;
  }) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (existing) throw AppError.emailAlreadyUsed();

    const role = await this.prisma.role.findUnique({
      where: { code: input.role },
      select: { id: true },
    });
    if (!role) throw AppError.validation({ role: ['Role tidak tersedia.'] });

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: input.fullName.trim(),
          email,
          phone: input.phone?.trim() || null,
          status: input.status,
          passwordHash: await this.credentials.hashUnusablePassword(),
          roles: { create: { roleId: role.id } },
        },
        select: this.userSelect(),
      });
      const invitation = await this.credentials.issueInvitation(user.id);
      return {
        ...this.mapUser(user),
        invitationToken: invitation.token,
        invitationExpiresAt: invitation.expiresAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.emailAlreadyUsed();
      }
      throw error;
    }
  }

  async update(userId: string, input: { fullName?: string; phone?: string | null }) {
    await this.assertExists(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      },
      select: this.userSelect(),
    });
    return this.mapUser(user);
  }

  async setStatus(userId: string, status: UserStatus) {
    await this.assertExists(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: this.userSelect(),
    });
    if (status !== UserStatus.ACTIVE) await this.credentials.revokeSessions(userId);
    return this.mapUser(user);
  }

  async resetMfa(userId: string): Promise<void> {
    await this.assertExists(userId);
    await this.credentials.resetMfa(userId);
  }

  async issuePasswordReset(userId: string) {
    await this.assertExists(userId);
    return this.credentials.issuePasswordReset(userId);
  }

  async deleteStudent(userId: string): Promise<void> {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, roles: { select: { role: { select: { code: true } } } } },
    });
    if (!target) throw AppError.notFound();
    if (target.roles.some(({ role }) => role.code !== 'STUDENT')) {
      throw AppError.validation({ userId: ['Hanya akun Pelajar yang dapat dihapus dari halaman ini.'] });
    }

    await this.credentials.revokeSessions(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: 'Pengguna dihapus',
        email: `deleted-${userId}@invalid.local`,
        phone: null,
        bio: null,
        avatarUrl: null,
        status: UserStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });
  }

  async startImpersonation(
    actor: ActiveSession,
    targetUserId: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null, status: UserStatus.ACTIVE },
      select: {
        id: true,
        roles: {
          take: 1,
          select: {
            role: {
              select: {
                code: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });
    if (!target) throw AppError.notFound();
    const assignment = target.roles[0];
    if (!assignment || assignment.role.code !== 'STUDENT') {
      throw AppError.validation({ userId: ['Sesi lihat-sebagai hanya tersedia untuk Pelajar aktif.'] });
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const device = await this.prisma.authSession.create({
      data: {
        userId: target.id,
        deviceName: 'Pratinjau oleh Master',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent?.slice(0, 400),
        expiresAt,
      },
    });
    return this.sessions.create(
      {
        userId: target.id,
        roleCode: 'STUDENT',
        permissions: assignment.role.permissions.map(({ permission }) => permission.code) as ActiveSession['permissions'],
        deviceRecordId: device.id,
        impersonatedByUserId: actor.id,
        originalSessionId: actor.sessionId,
      },
      30 * 60,
    );
  }

  async endImpersonation(session: ActiveSession) {
    if (!session.impersonatedByUserId || !session.originalSessionId) {
      throw AppError.permissionDenied();
    }
    const original = await this.sessions.touch(session.originalSessionId);
    if (
      !original ||
      original.userId !== session.impersonatedByUserId ||
      original.roleCode !== 'MASTER'
    ) {
      throw AppError.authenticationRequired();
    }
    await this.sessions.destroy(session.sessionId);
    await this.prisma.authSession.updateMany({
      where: { id: session.deviceRecordId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { sessionId: session.originalSessionId, csrfToken: original.csrfToken };
  }

  private async assertExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw AppError.notFound();
  }

  private userSelect() {
    return {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      roles: { select: { role: { select: { code: true } } }, take: 1 },
    } satisfies Prisma.UserSelect;
  }

  private mapUser<T extends { roles: Array<{ role: { code: string } }> }>(user: T) {
    const { roles, ...data } = user;
    return { ...data, role: (roles[0]?.role.code ?? 'STUDENT') as 'MASTER' | 'STUDENT' };
  }
}
