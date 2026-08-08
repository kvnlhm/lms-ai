import { Injectable } from '@nestjs/common';
import { PaymentOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { MembershipAccessPort } from '../../../shared/access/membership.port';

/**
 * Satu-satunya tempat pertanyaan "apakah orang ini anggota berbayar" dijawab.
 *
 * Jawabannya **diturunkan**, tidak disimpan sebagai status. Pesanan sudah
 * menjadi catatan siapa membayar dan sampai kapan; menyalin kesimpulannya ke
 * kolom lain menciptakan dua sumber kebenaran yang pasti berselisih pada kasus
 * yang paling mahal — keanggotaan yang baru habis, atau pembayaran yang baru
 * masuk (ADR-032).
 */
@Injectable()
export class MembershipAccessService implements MembershipAccessPort {
  constructor(private readonly prisma: PrismaService) {}

  async anggotaBerbayar(userId: string): Promise<boolean> {
    const sekarang = new Date();

    // Masa berlaku disaring di kueri, bukan sesudahnya: yang dibutuhkan hanya
    // "ada atau tidak", dan membaca barisnya untuk kemudian dibuang membuat
    // jalur terpanas di aplikasi ini menanggung biaya yang tidak dipakai.
    const dibayar = await this.prisma.registrationOrder.count({
      where: {
        provisionedUserId: userId,
        status: PaymentOrderStatus.PAID,
        OR: [{ accessEndsAt: null }, { accessEndsAt: { gt: sekarang } }],
      },
    });
    if (dibayar > 0) return true;

    const diberi = await this.prisma.manualAccessGrant.count({
      where: {
        userId,
        OR: [{ grantedUntil: null }, { grantedUntil: { gt: sekarang } }],
      },
    });
    return diberi > 0;
  }
}
