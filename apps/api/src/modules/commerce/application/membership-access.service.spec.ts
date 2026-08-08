import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MembershipAccessService } from './membership-access.service';

function buat({ pesanan = 0, grant = 0 }: { pesanan?: number; grant?: number } = {}) {
  const prisma = {
    registrationOrder: { count: jest.fn().mockResolvedValue(pesanan) },
    manualAccessGrant: { count: jest.fn().mockResolvedValue(grant) },
  } as unknown as PrismaService;
  return { service: new MembershipAccessService(prisma), prisma };
}

describe('MembershipAccessService', () => {
  it('menolak akun tanpa pesanan berbayar dan tanpa pemberian manual', async () => {
    const { service } = buat();

    await expect(service.anggotaBerbayar('user-1')).resolves.toBe(false);
  });

  it('menerima akun dengan pesanan berbayar yang masih berlaku', async () => {
    const { service } = buat({ pesanan: 1 });

    await expect(service.anggotaBerbayar('user-1')).resolves.toBe(true);
  });

  it('menerima akun yang diberi akses manual oleh Master', async () => {
    const { service } = buat({ grant: 1 });

    await expect(service.anggotaBerbayar('user-1')).resolves.toBe(true);
  });

  it('tidak menanyakan pemberian manual bila pesanannya sudah menjawab', async () => {
    // Jalur pelajar berbayar adalah jalur terpanas; pertanyaan kedua hanya
    // muncul untuk yang belum terjawab oleh pertanyaan pertama.
    const { service, prisma } = buat({ pesanan: 1, grant: 1 });

    await service.anggotaBerbayar('user-1');

    expect(prisma.manualAccessGrant.count).not.toHaveBeenCalled();
  });

  it('menyaring pesanan yang masa berlakunya sudah habis', async () => {
    const { service, prisma } = buat();

    await service.anggotaBerbayar('user-1');

    const where = (prisma.registrationOrder.count as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toBe('PAID');
    expect(where.provisionedUserId).toBe('user-1');
    // Kosong berarti selamanya, terisi berarti harus masih di depan.
    expect(where.OR).toEqual([
      { accessEndsAt: null },
      { accessEndsAt: { gt: expect.any(Date) } },
    ]);
  });

  it('menyaring pemberian manual yang masa berlakunya sudah habis', async () => {
    const { service, prisma } = buat();

    await service.anggotaBerbayar('user-1');

    const where = (prisma.manualAccessGrant.count as jest.Mock).mock.calls[0][0].where;
    expect(where.userId).toBe('user-1');
    expect(where.OR).toEqual([
      { grantedUntil: null },
      { grantedUntil: { gt: expect.any(Date) } },
    ]);
  });
});
