import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export interface ListUsersInput {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus;
  role?: 'MASTER' | 'STUDENT';
}

@Injectable()
export class UserAdminService {
  constructor(private readonly prisma: PrismaService) {}

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
        },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      total,
      items: items.map(({ roles, ...user }) => ({
        ...user,
        role: (roles[0]?.role.code ?? 'STUDENT') as 'MASTER' | 'STUDENT',
      })),
    };
  }
}
