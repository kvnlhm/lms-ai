import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryStatus,
  EnrollmentStatus,
  PaymentOrderStatus,
  Prisma,
  PublicationStatus,
  UserStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/configuration';
import { OutboxWriter } from '../../../infrastructure/outbox/outbox.writer';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { UserCredentialService } from '../../identity/application/user-credential.service';
import { ActivationNotifierService } from '../infrastructure/activation-notifier.service';
import { MidtransService, type MidtransStatus } from '../infrastructure/midtrans.service';
import type {
  CreateAccessTierDto,
  CreateCheckoutDto,
  MidtransNotificationDto,
  UpdateAccessTierDto,
} from '../presentation/dto/commerce.dto';

/**
 * Bentuk webhook status pesan WhatsApp, sebatas yang benar-benar dibaca.
 *
 * Meta menambah field tanpa pemberitahuan dan mengirim `messages` (pesan masuk)
 * lewat saluran yang sama, jadi seluruh cabangnya opsional: yang tidak dikenali
 * cukup dilewati, bukan menggagalkan seluruh webhook.
 */
export interface WhatsAppStatusPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{
          id?: string;
          status?: string;
          errors?: Array<{ code?: number; title?: string; message?: string }>;
        }>;
      };
    }>;
  }>;
}

const tierInclude = {
  courses: {
    orderBy: { position: 'asc' as const },
    include: {
      course: {
        select: { id: true, slug: true, title: true, thumbnailUrl: true, status: true },
      },
    },
  },
} satisfies Prisma.AccessTierInclude;

@Injectable()
export class CommerceService {
  private readonly config: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: UserCredentialService,
    private readonly outbox: OutboxWriter,
    private readonly midtrans: MidtransService,
    private readonly notifier: ActivationNotifierService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.config = config.get('app', { infer: true });
  }

  async publicTiers() {
    const tiers = await this.prisma.accessTier.findMany({
      where: {
        isActive: true,
        courses: { some: { course: { status: PublicationStatus.PUBLISHED } } },
      },
      include: tierInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return tiers.map((tier) => this.mapTier(tier, true));
  }

  async adminTiers() {
    const tiers = await this.prisma.accessTier.findMany({
      include: tierInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return tiers.map((tier) => this.mapTier(tier, false));
  }

  async createTier(input: CreateAccessTierDto) {
    await this.assertCourses(input.courseIds);
    assertHargaNormalMasukAkal(input.originalPriceIdr, input.priceIdr);
    try {
      const tier = await this.prisma.accessTier.create({
        data: {
          name: input.name.trim(),
          slug: input.slug,
          description: input.description?.trim() || null,
          priceIdr: input.priceIdr,
          originalPriceIdr: input.originalPriceIdr ?? null,
          durationMonths: input.durationMonths ?? null,
          isActive: input.isActive ?? true,
          position: input.position ?? 0,
          courses: {
            create: input.courseIds.map((courseId, position) => ({ courseId, position })),
          },
        },
        include: tierInclude,
      });
      return this.mapTier(tier, false);
    } catch (error) {
      this.rethrowTierConflict(error);
    }
  }

  async updateTier(tierId: string, input: UpdateAccessTierDto) {
    const sekarang = await this.assertTier(tierId);
    if (input.courseIds) await this.assertCourses(input.courseIds);
    // Dibandingkan terhadap nilai yang akan berlaku setelah perubahan, bukan
    // hanya yang dikirim: menurunkan harga jual saja pun dapat membuat harga
    // normal yang lama menjadi tidak masuk akal.
    assertHargaNormalMasukAkal(
      input.originalPriceIdr !== undefined ? input.originalPriceIdr : sekarang.originalPriceIdr,
      input.priceIdr !== undefined ? input.priceIdr : sekarang.priceIdr,
    );
    try {
      const tier = await this.prisma.$transaction(async (tx) => {
        if (input.courseIds) {
          await tx.accessTierCourse.deleteMany({ where: { tierId } });
        }
        return tx.accessTier.update({
          where: { id: tierId },
          data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.description !== undefined
              ? { description: input.description?.trim() || null }
              : {}),
            ...(input.priceIdr !== undefined ? { priceIdr: input.priceIdr } : {}),
            ...(input.originalPriceIdr !== undefined
              ? { originalPriceIdr: input.originalPriceIdr }
              : {}),
            ...(input.durationMonths !== undefined
              ? { durationMonths: input.durationMonths }
              : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.position !== undefined ? { position: input.position } : {}),
            ...(input.courseIds
              ? {
                  courses: {
                    create: input.courseIds.map((courseId, position) => ({
                      courseId,
                      position,
                    })),
                  },
                }
              : {}),
          },
          include: tierInclude,
        });
      });
      return this.mapTier(tier, false);
    } catch (error) {
      this.rethrowTierConflict(error);
    }
  }

  async createCheckout(input: CreateCheckoutDto) {
    if (!input.termsAccepted) {
      throw AppError.validation({ termsAccepted: ['Persetujuan syarat wajib diberikan.'] });
    }
    const tier = await this.prisma.accessTier.findFirst({
      where: { id: input.tierId, isActive: true },
      include: tierInclude,
    });
    if (!tier || tier.courses.length === 0) throw AppError.notFound();
    const orderCode = `REG-${randomUUID().replaceAll('-', '')}`;
    const expiresAt = new Date(Date.now() + this.config.commerce.orderTtlMinutes * 60_000);
    const order = await this.prisma.registrationOrder.create({
      data: {
        orderCode,
        tierId: tier.id,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: normalizePhone(input.phone),
        grossAmount: tier.priceIdr,
        expiresAt,
      },
    });
    try {
      const snap = await this.midtrans.createSnap({
        orderCode,
        amount: tier.priceIdr,
        itemName: tier.name,
        fullName: order.fullName,
        email: order.email,
        phone: order.phone,
      });
      await this.prisma.registrationOrder.update({
        where: { id: order.id },
        data: { snapToken: snap.token, redirectUrl: snap.redirect_url },
      });
      return {
        orderCode,
        snapToken: snap.token,
        redirectUrl: snap.redirect_url,
        ...this.midtrans.clientConfiguration,
        expiresAt,
      };
    } catch (error) {
      await this.prisma.registrationOrder.update({
        where: { id: order.id },
        data: { status: PaymentOrderStatus.FAILED },
      });
      throw error;
    }
  }

  async orderStatus(orderCode: string) {
    const order = await this.prisma.registrationOrder.findUnique({
      where: { orderCode },
      select: {
        orderCode: true,
        status: true,
        emailDeliveryStatus: true,
        whatsAppDeliveryStatus: true,
        accessEndsAt: true,
      },
    });
    if (!order) throw AppError.notFound();
    return order;
  }

  async handleMidtrans(notification: MidtransNotificationDto): Promise<void> {
    if (!this.midtrans.verifySignature(notification)) {
      throw AppError.permissionDenied();
    }
    // Nilai yang diambil langsung dari Midtrans menjadi sumber kanonis,
    // bukan body webhook yang datang dari jaringan publik.
    const status = await this.midtrans.getStatus(notification.order_id);
    const eventKey = createHash('sha256')
      .update(
        `${status.order_id}:${status.transaction_id ?? ''}:${status.transaction_status}:${status.fraud_status ?? ''}`,
      )
      .digest('hex');
    const outcome = await this.applyPaymentStatus(status, eventKey);
    if (outcome?.notify) {
      await this.deliverActivation(outcome.orderId, outcome.userId);
      return;
    }
    const pendingDelivery = await this.prisma.registrationOrder.findUnique({
      where: { orderCode: status.order_id },
      select: {
        id: true,
        provisionedUserId: true,
        status: true,
        emailDeliveryStatus: true,
        whatsAppDeliveryStatus: true,
      },
    });
    if (
      pendingDelivery?.status === PaymentOrderStatus.PAID &&
      pendingDelivery.provisionedUserId &&
      (pendingDelivery.emailDeliveryStatus === 'PENDING' ||
        pendingDelivery.whatsAppDeliveryStatus === 'PENDING')
    ) {
      await this.deliverActivation(pendingDelivery.id, pendingDelivery.provisionedUserId);
    }
  }

  private async applyPaymentStatus(status: MidtransStatus, eventKey: string) {
    const order = await this.prisma.registrationOrder.findUnique({
      where: { orderCode: status.order_id },
      include: { tier: { include: tierInclude } },
    });
    if (!order) throw AppError.notFound();
    if (!amountMatches(status.gross_amount, order.grossAmount)) {
      throw AppError.validation({ grossAmount: ['Nominal pembayaran tidak sesuai dengan order.'] });
    }
    const nextStatus = mapPaymentStatus(status);
    // Paket adalah membership akademi. Daftar kursus pada paket hanya dipakai
    // untuk presentasi/kurasi di halaman harga; hak akses pembayaran selalu
    // mencakup seluruh kursus yang sudah terbit.
    const publishedCourses = nextStatus === PaymentOrderStatus.PAID
      ? await this.prisma.course.findMany({
          where: { status: PublicationStatus.PUBLISHED },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const unusablePassword =
      nextStatus === PaymentOrderStatus.PAID ? await this.credentials.hashUnusablePassword() : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.paymentWebhookEvent.create({
          data: {
            orderId: order.id,
            providerEventKey: eventKey,
            payload: status as unknown as Prisma.InputJsonValue,
          },
        });
        if (order.status === PaymentOrderStatus.PAID) {
          await tx.paymentWebhookEvent.update({
            where: { providerEventKey: eventKey },
            data: { processedAt: new Date() },
          });
          return null;
        }
        if (nextStatus !== PaymentOrderStatus.PAID) {
          await tx.registrationOrder.update({
            where: { id: order.id },
            data: {
              status: nextStatus,
              providerTransactionId: status.transaction_id,
              paymentType: status.payment_type,
              fraudStatus: status.fraud_status,
            },
          });
          await tx.paymentWebhookEvent.update({
            where: { providerEventKey: eventKey },
            data: { processedAt: new Date() },
          });
          return null;
        }

        const now = new Date();
        const accessEndsAt = order.tier.durationMonths
          ? addMonths(now, order.tier.durationMonths)
          : null;
        let user = await tx.user.findFirst({
          where: { email: order.email, deletedAt: null },
          select: { id: true, emailVerifiedAt: true },
        });
        if (!user) {
          const studentRole = await tx.role.findUnique({
            where: { code: 'STUDENT' },
            select: { id: true },
          });
          if (!studentRole || !unusablePassword) {
            throw new Error('Role STUDENT belum tersedia.');
          }
          user = await tx.user.create({
            data: {
              email: order.email,
              fullName: order.fullName,
              phone: order.phone,
              status: UserStatus.ACTIVE,
              passwordHash: unusablePassword,
              roles: { create: { roleId: studentRole.id } },
            },
            select: { id: true, emailVerifiedAt: true },
          });
        }

        for (const course of publishedCourses) {
          const existing = await tx.enrollment.findUnique({
            where: { userId_courseId: { userId: user.id, courseId: course.id } },
            select: { id: true, accessEndsAt: true },
          });
          const effectiveEnd =
            existing?.accessEndsAt === null
              ? null
              : laterDate(existing?.accessEndsAt, accessEndsAt);
          const enrollment = existing
            ? await tx.enrollment.update({
                where: { id: existing.id },
                data: {
                  status: EnrollmentStatus.ACTIVE,
                  accessStartsAt: now,
                  accessEndsAt: effectiveEnd,
                  removedAt: null,
                },
              })
            : await tx.enrollment.create({
                data: {
                  userId: user.id,
                  courseId: course.id,
                  status: EnrollmentStatus.ACTIVE,
                  accessStartsAt: now,
                  accessEndsAt,
                },
              });
          const requiredLessons = await tx.lesson.count({
            where: {
              isActive: true,
              isRequired: true,
              module: { courseId: course.id, isActive: true },
            },
          });
          await tx.courseProgress.upsert({
            where: { enrollmentId: enrollment.id },
            create: { enrollmentId: enrollment.id, requiredLessonsTotal: requiredLessons },
            update: { requiredLessonsTotal: requiredLessons },
          });
        }

        await tx.registrationOrder.update({
          where: { id: order.id },
          data: {
            status: PaymentOrderStatus.PAID,
            providerTransactionId: status.transaction_id,
            paymentType: status.payment_type,
            fraudStatus: status.fraud_status,
            paidAt: now,
            accessStartsAt: now,
            accessEndsAt,
            provisionedUserId: user.id,
          },
        });
        await tx.paymentWebhookEvent.update({
          where: { providerEventKey: eventKey },
          data: { processedAt: now },
        });
        await this.outbox.append(tx, {
          eventType: 'commerce.registration_paid',
          aggregateType: 'registration_order',
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            userId: user.id,
            tierId: order.tierId,
            courseIds: publishedCourses.map((course) => course.id),
          },
        });
        return { notify: true as const, orderId: order.id, userId: user.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  private async deliverActivation(orderId: string, userId: string): Promise<void> {
    const order = await this.prisma.registrationOrder.findUnique({
      where: { id: orderId },
      include: { tier: { select: { name: true } } },
    });
    if (!order) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    const activationUrl = !user?.emailVerifiedAt
      ? `${this.config.webUrl}/accept-invitation?token=${encodeURIComponent(
          (await this.credentials.issueInvitation(userId)).token,
        )}`
      : `${this.config.webUrl}/login`;
    const result = await this.notifier.send({
      fullName: order.fullName,
      email: order.email,
      phone: order.phone,
      activationUrl,
      tierName: order.tier.name,
    });
    await this.prisma.registrationOrder.update({
      where: { id: orderId },
      data: {
        emailDeliveryStatus: result.email,
        whatsAppDeliveryStatus: result.whatsApp,
        whatsAppMessageId: result.whatsAppMessageId,
        deliveryError: result.errors.join(' | ').slice(0, 1_000) || null,
      },
    });
  }

  /**
   * Menerapkan tanda terima pengantaran dari webhook WhatsApp.
   *
   * Meta mengirim status berkali-kali untuk satu pesan (`sent`, `delivered`,
   * `read`) dan tidak menjamin urutannya, jadi status hanya boleh maju.
   * Tanpa aturan itu `read` yang tiba lebih dulu akan dimundurkan kembali
   * oleh `sent` yang menyusul, dan kolomnya berakhir menyesatkan.
   *
   * Order yang tidak dikenali diabaikan diam-diam: webhook ini menerima status
   * seluruh pesan nomor bisnis itu, termasuk yang dikirim di luar aplikasi ini.
   */
  async handleWhatsAppStatus(payload: WhatsAppStatusPayload): Promise<void> {
    const statuses = (payload.entry ?? [])
      .flatMap((entry) => entry.changes ?? [])
      .flatMap((change) => change.value?.statuses ?? []);

    for (const status of statuses) {
      if (!status.id) continue;
      const order = await this.prisma.registrationOrder.findUnique({
        where: { whatsAppMessageId: status.id },
        select: { id: true, whatsAppDeliveryStatus: true },
      });
      if (!order) continue;

      const next = mapWhatsAppDeliveryStatus(status.status);
      if (!next) continue;
      // Pesan yang sudah terbukti sampai tidak dapat gagal belakangan, dan
      // `sent` yang menyusul tidak boleh menghapus bukti pengantaran.
      if (order.whatsAppDeliveryStatus === DeliveryStatus.DELIVERED) continue;
      if (next === DeliveryStatus.SENT && order.whatsAppDeliveryStatus !== DeliveryStatus.PENDING) {
        continue;
      }

      await this.prisma.registrationOrder.update({
        where: { id: order.id },
        data: {
          whatsAppDeliveryStatus: next,
          deliveryError:
            next === DeliveryStatus.FAILED ? whatsAppFailureReason(status).slice(0, 1_000) : null,
        },
      });
    }
  }

  private async assertTier(
    tierId: string,
  ): Promise<{ priceIdr: number; originalPriceIdr: number | null }> {
    const tier = await this.prisma.accessTier.findUnique({
      where: { id: tierId },
      select: { id: true, priceIdr: true, originalPriceIdr: true },
    });
    if (!tier) throw AppError.notFound();
    return { priceIdr: tier.priceIdr, originalPriceIdr: tier.originalPriceIdr };
  }

  private async assertCourses(courseIds: string[]): Promise<void> {
    if (courseIds.length === 0) {
      throw AppError.validation({ courseIds: ['Pilih minimal satu kursus.'] });
    }
    const count = await this.prisma.course.count({ where: { id: { in: courseIds } } });
    if (count !== courseIds.length) {
      throw AppError.validation({ courseIds: ['Satu atau lebih kursus tidak ditemukan.'] });
    }
  }

  private rethrowTierConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.validation({ slug: ['Slug atau urutan paket sudah digunakan.'] });
    }
    throw error;
  }

  private mapTier(
    tier: Prisma.AccessTierGetPayload<{ include: typeof tierInclude }>,
    publishedOnly: boolean,
  ) {
    return {
      id: tier.id,
      slug: tier.slug,
      name: tier.name,
      description: tier.description,
      priceIdr: tier.priceIdr,
      originalPriceIdr: tier.originalPriceIdr,
      durationMonths: tier.durationMonths,
      isLifetime: tier.durationMonths === null,
      isActive: tier.isActive,
      position: tier.position,
      courses: tier.courses
        .filter(
          ({ course }) => !publishedOnly || course.status === PublicationStatus.PUBLISHED,
        )
        .map(({ course }) => ({
          id: course.id,
          slug: course.slug,
          title: course.title,
          thumbnailUrl: course.thumbnailUrl,
        })),
    };
  }
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function laterDate(current: Date | null | undefined, candidate: Date | null): Date | null {
  if (!candidate) return null;
  if (!current) return candidate;
  return current > candidate ? current : candidate;
}

export function amountMatches(raw: string, expected: number): boolean {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && Math.abs(parsed - expected) < Number.EPSILON;
}

export function mapPaymentStatus(status: MidtransStatus): PaymentOrderStatus {
  if (
    status.status_code === '200' &&
    ['settlement', 'capture'].includes(status.transaction_status) &&
    status.fraud_status !== 'deny' &&
    status.fraud_status !== 'challenge'
  ) {
    return PaymentOrderStatus.PAID;
  }
  if (status.transaction_status === 'expire') return PaymentOrderStatus.EXPIRED;
  if (['cancel', 'deny'].includes(status.transaction_status)) return PaymentOrderStatus.CANCELLED;
  if (['refund', 'partial_refund'].includes(status.transaction_status)) {
    return PaymentOrderStatus.REFUNDED;
  }
  if (status.transaction_status === 'failure') return PaymentOrderStatus.FAILED;
  return PaymentOrderStatus.PENDING;
}

/**
 * Menerjemahkan status pesan Meta ke keadaan pengiriman yang kita catat.
 *
 * `read` diperlakukan sama dengan `delivered`: keduanya sama-sama membuktikan
 * pesannya sampai, dan menyimpan apakah seseorang sudah membacanya bukan urusan
 * catatan pengiriman order. Status lain — termasuk yang belum ada saat ini —
 * dikembalikan `null` supaya kolomnya tidak berubah.
 */
function mapWhatsAppDeliveryStatus(status: string | undefined): DeliveryStatus | null {
  switch (status) {
    case 'sent':
      return DeliveryStatus.SENT;
    case 'delivered':
    case 'read':
      return DeliveryStatus.DELIVERED;
    case 'failed':
      return DeliveryStatus.FAILED;
    default:
      return null;
  }
}

/**
 * Alasan kegagalan dari Meta, digabung menjadi satu kalimat yang dapat dibaca.
 *
 * Kode galatnya ikut disimpan karena itulah yang menentukan tindakan: `131049`
 * berarti Meta menahan pesannya, `131026` berarti nomornya tidak dapat
 * menerima, dan keduanya menuntut jawaban yang sama sekali berbeda.
 */
function whatsAppFailureReason(status: {
  errors?: Array<{ code?: number; title?: string; message?: string }>;
}): string {
  const error = status.errors?.[0];
  if (!error) return 'WhatsApp gagal diantar tanpa keterangan dari Meta.';
  const keterangan = error.message ?? error.title ?? 'tanpa keterangan';
  return error.code ? `WhatsApp gagal diantar (${error.code}): ${keterangan}` : keterangan;
}

/**
 * Harga normal hanya berarti bila lebih tinggi dari harga jualnya.
 *
 * Angka yang sama atau lebih rendah menghasilkan coretan yang menjanjikan
 * potongan yang tidak ada — persoalan kejujuran harga, bukan sekadar tampilan.
 */
function assertHargaNormalMasukAkal(
  originalPriceIdr: number | null | undefined,
  priceIdr: number,
): void {
  if (originalPriceIdr === null || originalPriceIdr === undefined) return;
  if (originalPriceIdr <= priceIdr) {
    throw AppError.validation({
      originalPriceIdr: ['Harga normal harus lebih tinggi daripada harga jual.'],
    });
  }
}
