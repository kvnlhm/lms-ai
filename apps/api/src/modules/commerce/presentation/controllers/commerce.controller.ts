import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import type { Request } from 'express';
import {
  ApiEnvelope,
  ApiEnvelopeArray,
  ApiErrors,
} from '../../../../shared/http/api-envelope';
import {
  Public,
  RequirePermissions,
} from '../../../identity/presentation/decorators';
import { CommerceService } from '../../application/commerce.service';
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

@ApiTags('registration')
@Controller()
export class CommerceController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly audit: AuditService,
    private readonly checkoutRateLimiter: CheckoutRateLimiter,
  ) {}

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
  async midtransWebhook(
    // Midtrans mengirim ~22 field dan menambah field baru tanpa pemberitahuan.
    // Pipe global memakai `forbidNonWhitelisted`, yang akan menolak seluruh
    // notifikasi hanya karena ada field tak dikenal — pembayaran lunas tidak
    // akan pernah terproses. Di sini field asing cukup dibuang oleh
    // `whitelist`, sehingga service tetap hanya melihat field terdeklarasi.
    @Body(new ValidationPipe({ whitelist: true, transform: true, errorHttpStatusCode: 422 }))
    dto: MidtransNotificationDto,
  ) {
    await this.commerce.handleMidtrans(dto);
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
