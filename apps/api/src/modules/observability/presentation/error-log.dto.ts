import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorSource, ErrorStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListErrorQueryDto {
  @ApiPropertyOptional({ enum: ErrorStatus })
  @IsOptional()
  @IsEnum(ErrorStatus)
  status?: ErrorStatus;

  @ApiPropertyOptional({ enum: ErrorSource })
  @IsOptional()
  @IsEnum(ErrorSource)
  source?: ErrorSource;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ErrorEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() fingerprint!: string;
  @ApiProperty({ enum: ErrorSource }) source!: ErrorSource;
  @ApiProperty({ enum: ErrorStatus }) status!: ErrorStatus;
  @ApiProperty() type!: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) stack!: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true }) context!: unknown;
  @ApiProperty() occurrences!: number;
  @ApiProperty({ format: 'date-time' }) firstSeenAt!: Date;
  @ApiProperty({ format: 'date-time' }) lastSeenAt!: Date;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  resolvedAt!: Date | null;
}

export class ErrorSummaryDto {
  @ApiProperty() open!: number;
  @ApiProperty() resolved!: number;
  @ApiProperty({ description: 'Galat berbeda yang terlihat dalam 24 jam terakhir' })
  lastDay!: number;
}

/**
 * Laporan galat dari browser.
 *
 * Endpoint ini publik — galat yang paling perlu diketahui justru terjadi pada
 * halaman login dan pendaftaran, sebelum ada sesi. Karena itu payload-nya
 * dibatasi ketat dan tidak ada satu pun field yang dipercaya apa adanya:
 * sumber, status, dan waktu ditentukan server.
 */
export class ReportClientErrorDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) type!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) message!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4_000) stack?: string;
  @ApiPropertyOptional({ description: 'Path halaman, tanpa query dan tanpa origin' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  path?: string;
}
