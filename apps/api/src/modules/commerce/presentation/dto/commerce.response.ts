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
  @ApiPropertyOptional({ nullable: true }) accessEndsAt!: Date | null;
}

export class WebhookAcceptedDto {
  @ApiProperty({ example: true }) accepted!: boolean;
}
