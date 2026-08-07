import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TierCourseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) thumbnailUrl!: string | null;
}

export class AccessTierDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) promoCode!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) promoDiscountIdr!: number | null;
  @ApiProperty() priceIdr!: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) originalPriceIdr!: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) durationMonths!: number | null;
  @ApiProperty() isLifetime!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() position!: number;
  @ApiProperty({ type: [TierCourseDto] }) courses!: TierCourseDto[];
}

export class CheckoutResponseDto {
  @ApiProperty() orderCode!: string;
  @ApiProperty() snapToken!: string;
  @ApiProperty() redirectUrl!: string;
  @ApiProperty() clientKey!: string;
  @ApiProperty() isProduction!: boolean;
  @ApiProperty() expiresAt!: Date;
}

export class RegistrationOrderStatusDto {
  @ApiProperty() orderCode!: string;
  @ApiProperty() status!: string;
  @ApiProperty() emailDeliveryStatus!: string;
  @ApiProperty() whatsAppDeliveryStatus!: string;
  // Tanpa `type` dan `format`, Swagger memancarkan skema objek kosong sehingga
  // klien hasil generasi menerimanya sebagai Record<string, never> — bukan
  // tanggal yang dapat diformat.
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  accessEndsAt!: Date | null;
}

export class WebhookAcceptedDto {
  @ApiProperty({ example: true }) accepted!: boolean;
}

export const PAYMENT_ORDER_STATUSES = [
  'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED',
] as const;

export class AdminRegistrationOrderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Kode yang dipakai Midtrans dan halaman status.' }) orderCode!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ description: 'Rupiah, tanpa desimal.' }) grossAmount!: number;
  @ApiProperty({ enum: PAYMENT_ORDER_STATUSES }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) paymentType!: string | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) paidAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty() tierName!: string;
  @ApiProperty({ description: 'Status pengantaran email undangan.' }) emailDeliveryStatus!: string;
  @ApiProperty({ description: 'Status pengantaran WhatsApp.' }) whatsAppDeliveryStatus!: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Akun yang dibuatkan setelah pembayaran lunas; kosong bila belum.',
  })
  provisionedUserId!: string | null;
}

/**
 * Dihitung dari seluruh pesanan, bukan dari halaman yang sedang dibuka —
 * sama seperti ringkasan perpustakaan video.
 */
export class RegistrationOrderSummaryDto {
  @ApiProperty() total!: number;
  @ApiProperty() paid!: number;
  @ApiProperty() pending!: number;
  @ApiProperty({ description: 'Gagal, kedaluwarsa, dan dibatalkan digabung.' }) failed!: number;
  @ApiProperty({ description: 'Jumlah rupiah dari pesanan yang lunas.' }) paidAmount!: number;
}
