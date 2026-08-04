import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAccessTierDto {
  @ApiProperty({ example: 'Pro 12 Bulan' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'pro-12-bulan' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string;

  @ApiProperty({ example: 1_499_000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  priceIdr!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 2_999_000,
    description:
      'Harga sebelum diskon, ditampilkan tercoret di samping harga jual. ' +
      'Null berarti paket ini tampil dengan satu harga saja.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  originalPriceIdr?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 12,
    description: 'Jumlah bulan. Null berarti akses lifetime.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_200)
  durationMonths?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  position?: number;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  courseIds!: string[];
}

export class UpdateAccessTierDto extends PartialType(CreateAccessTierDto) {}

export class CreateCheckoutDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tierId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ example: '6281234567890' })
  @IsString()
  @Matches(/^\+?[0-9]{9,16}$/, { message: 'Nomor WhatsApp tidak valid.' })
  phone!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  termsAccepted!: boolean;
}

export class MidtransNotificationDto {
  @IsString() order_id!: string;
  @IsString() status_code!: string;
  @IsString() gross_amount!: string;
  @IsString() signature_key!: string;
  @IsString() transaction_status!: string;
  @IsOptional() @IsString() transaction_id?: string;
  @IsOptional() @IsString() payment_type?: string;
  @IsOptional() @IsString() fraud_status?: string;
}

export const PAYMENT_ORDER_STATUS_VALUES = [
  'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED',
] as const;

export class ListRegistrationOrderQueryDto {
  @ApiPropertyOptional({ description: 'Kode pesanan, nama, email, atau nomor telepon.' })
  @IsOptional() @IsString() @MaxLength(200) search?: string;

  @ApiPropertyOptional({ enum: PAYMENT_ORDER_STATUS_VALUES })
  @IsOptional() @IsIn(PAYMENT_ORDER_STATUS_VALUES) status?: (typeof PAYMENT_ORDER_STATUS_VALUES)[number];

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
