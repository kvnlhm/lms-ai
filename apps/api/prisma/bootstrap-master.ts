import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const permissionCodes = [
  'users.read', 'users.manage', 'users.security.manage', 'courses.manage',
  'enrollments.manage', 'discussions.moderate', 'analytics.read', 'reports.export',
  'audit.read', 'roles.manage', 'announcements.manage',
];

async function main(): Promise<void> {
  const email = required('BOOTSTRAP_MASTER_EMAIL').trim().toLowerCase();
  const fullName = required('BOOTSTRAP_MASTER_NAME').trim();
  const password = required('BOOTSTRAP_MASTER_PASSWORD');
  if (password.length < 12) throw new Error('BOOTSTRAP_MASTER_PASSWORD minimal 12 karakter.');

  const userCount = await prisma.user.count();
  if (userCount !== 0) {
    throw new Error('Bootstrap ditolak: database sudah memiliki pengguna.');
  }

  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({ data: { code: 'MASTER', name: 'Master' } });
    await tx.role.create({ data: { code: 'STUDENT', name: 'Pelajar' } });
    for (const code of permissionCodes) {
      const permission = await tx.permission.create({ data: { code, name: code } });
      await tx.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    const user = await tx.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
  });

  console.log(`Master pertama dibuat untuk ${email}. Login dan aktifkan MFA segera.`);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} wajib diisi.`);
  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Bootstrap gagal.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
