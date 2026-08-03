import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../../../config/configuration';
import { AppError } from '../../../../shared/errors/app-error';
import {
  ApiEnvelope,
  ApiEnvelopeArray,
  ApiErrors,
} from '../../../../shared/http/api-envelope';
import {
  Public,
  RequirePermissions,
} from '../../../identity/presentation/decorators';
import {
  CommerceService,
  type WhatsAppStatusPayload,
} from '../../application/commerce.service';
import { AuditService } from '../../../../shared/audit/audit.service';
import { CurrentUser } from '../../../identity/presentation/decorators';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CheckoutRateLimiter } from '../../application/checkout-rate-limiter';
import {
  CreateAccessTierDto,
  CreateCheckoutDto,
  MidtransNotificationDto,
  UpdateAccessTierDto,
} from '../dto/commerce.dto';
import {
  AccessTierDto,
  CheckoutResponseDto,
  RegistrationOrderStatusDto,
  WebhookAcceptedDto,
} from '../dto/commerce.response';

/**
 * Validasi khusus notifikasi Midtrans: membuang field di luar DTO alih-alih
 * menolak permintaannya. Lihat alasannya di `midtransWebhook`.
 */
export const MIDTRANS_NOTIFICATION_PIPE = new ValidationPipe({
  whitelist: true,
  transform: true,
  errorHttpStatusCode: 422,
});

/**
 * Membuktikan webhook benar-benar datang dari Meta.
 *
 * Meta menandatangani **badan mentah** permintaan dengan rahasia aplikasi,
 * jadi yang dihitung ulang harus byte yang persis sama seperti yang dikirim —
 * bukan hasil `JSON.stringify` dari objek yang sudah diurai, yang berbeda pada
 * urutan kunci maupun escaping. `bootstrap.ts` menyimpan byte itu di
 * `request.rawBody` khusus untuk jalur ini.
 */
function verifyMetaSignature(request: Request, appSecret: string | undefined): boolean {
  if (!appSecret) return false;
  const header = request.header('x-hub-signature-256');
  if (!header?.startsWith('sha256=')) return false;
  const raw = request.rawBody;
  if (!raw) return false;

  const expected = createHmac('sha256', appSecret).update(raw).digest();
  const received = Buffer.from(header.slice('sha256='.length), 'hex');
  // Panjang harus diperiksa lebih dulu: `timingSafeEqual` melempar, bukan
  // membalas salah, ketika panjang keduanya berbeda.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

@ApiTags('registration')
@Controller()
export class CommerceController {
  private readonly config: AppConfig;

  constructor(
    private readonly commerce: CommerceService,
    private readonly audit: AuditService,
    private readonly checkoutRateLimiter: CheckoutRateLimiter,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.config = config.get('app', { infer: true });
  }

  @Public()
  @Get('registration/tiers')
  @ApiOperation({ summary: 'Daftar paket registrasi yang aktif' })
  @ApiEnvelopeArray(AccessTierDto)
  async publicTiers() {
    return this.commerce.publicTiers();
  }

  @Public()
  @Post('registration/checkout')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat order dan sesi Midtrans Snap' })
  @ApiEnvelope(CheckoutResponseDto)
  @ApiErrors(404, 422, 429)
  async checkout(@Body() dto: CreateCheckoutDto, @Req() request: Request) {
    await this.checkoutRateLimiter.consume(request.ip ?? 'unknown', dto.email);
    return this.commerce.createCheckout(dto);
  }

  @Public()
  @Get('registration/orders/:orderCode')
  @ApiOperation({ summary: 'Melihat status order registrasi tanpa data pribadi' })
  @ApiEnvelope(RegistrationOrderStatusDto)
  @ApiErrors(404)
  async orderStatus(@Param('orderCode') orderCode: string) {
    return this.commerce.orderStatus(orderCode);
  }

  @Public()
  @Post('webhooks/midtrans')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menerima notifikasi transaksi Midtrans yang ditandatangani' })
  @ApiEnvelope(WebhookAcceptedDto)
  @ApiErrors(403, 404, 422)
  // Midtrans mengirim ~22 field dan bisa menambah field baru tanpa
  // pemberitahuan. Pipe global memakai `forbidNonWhitelisted`, sehingga satu
  // field tak dikenal saja menolak seluruh notifikasi — pembayaran lunas tidak
  // pernah terproses dan pelajar tidak mendapat akses.
  //
  // Body sengaja diterima mentah: ValidationPipe melewatkan parameter yang
  // metatype-nya `Object`, jadi pipe global tidak ikut campur. Validasi
  // dilakukan eksplisit di bawah dengan `whitelist` saja, sehingga field asing
  // dibuang dan service tetap hanya melihat field terdeklarasi.
  async midtransWebhook(@Body() rawNotification: Record<string, unknown>) {
    const dto = (await MIDTRANS_NOTIFICATION_PIPE.transform(rawNotification, {
      type: 'body',
      metatype: MidtransNotificationDto,
    })) as MidtransNotificationDto;

    await this.commerce.handleMidtrans(dto);
    return { accepted: true };
  }

  /**
   * Jabat tangan pemasangan URL webhook di dashboard Meta.
   *
   * Meta memanggilnya sekali dengan token yang kita tentukan sendiri dan
   * menuntut `hub.challenge` dikembalikan **mentah** — bukan di dalam amplop
   * `{ data, meta }`. Karena itu responsnya ditulis langsung ke `Response`,
   * yang sekaligus melewati interceptor amplop.
   */
  @Public()
  @Get('webhooks/whatsapp')
  @ApiOperation({ summary: 'Verifikasi kepemilikan URL webhook oleh Meta' })
  @ApiErrors(403)
  verifyWhatsAppWebhook(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() response: Response,
  ): void {
    const expected = this.config.commerce.whatsApp.webhookVerifyToken;
    if (!expected || mode !== 'subscribe' || token !== expected) {
      response.status(403).send();
      return;
    }
    response.status(200).type('text/plain').send(challenge ?? '');
  }

  /**
   * Tanda terima pengantaran pesan WhatsApp.
   *
   * Selalu membalas 200 selama tanda tangannya sah. Meta mengulang kirim
   * webhook yang dibalas galat, dan status yang tidak dikenali bukan alasan
   * untuk memancing pengulangan tanpa akhir.
   */
  @Public()
  @Post('webhooks/whatsapp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menerima status pengantaran pesan WhatsApp dari Meta' })
  @ApiEnvelope(WebhookAcceptedDto)
  @ApiErrors(403)
  async whatsAppWebhook(
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    // Endpoint publik yang menulis ke basis data. Tanpa rahasia aplikasi tidak
    // ada cara membuktikan asal permintaannya, jadi pintunya ditutup — bukan
    // dibuka dengan asumsi baik.
    if (!verifyMetaSignature(request, this.config.commerce.whatsApp.appSecret)) {
      throw AppError.permissionDenied();
    }
    await this.commerce.handleWhatsAppStatus(payload as WhatsAppStatusPayload);
    return { accepted: true };
  }

  @Get('admin/access-tiers')
  @RequirePermissions(PERMISSIONS.COMMERCE_MANAGE)
  @ApiEnvelopeArray(AccessTierDto)
  async adminTiers() {
    return this.commerce.adminTiers();
  }

  @Post('admin/access-tiers')
  @RequirePermissions(PERMISSIONS.COMMERCE_MANAGE)
  @HttpCode(201)
  @ApiEnvelope(AccessTierDto)
  @ApiErrors(401, 403, 422)
  async createTier(
    @Body() dto: CreateAccessTierDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const tier = await this.commerce.createTier(dto);
    await this.record(request, user, 'access_tier.created', tier.id, tier);
    return tier;
  }

  @Patch('admin/access-tiers/:tierId')
  @RequirePermissions(PERMISSIONS.COMMERCE_MANAGE)
  @ApiEnvelope(AccessTierDto)
  @ApiErrors(401, 403, 404, 422)
  async updateTier(
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Body() dto: UpdateAccessTierDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const tier = await this.commerce.updateTier(tierId, dto);
    await this.record(request, user, 'access_tier.updated', tierId, dto);
    return tier;
  }

  private async record(
    request: Request,
    user: AuthenticatedUser,
    action: string,
    targetId: string,
    after: unknown,
  ): Promise<void> {
    await this.audit.record({
      actorUserId: user.id,
      action,
      targetType: 'access_tier',
      targetId,
      after,
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
  }
}
