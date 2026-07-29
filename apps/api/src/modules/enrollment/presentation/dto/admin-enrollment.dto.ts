import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const STATUSES = ['ACTIVE', 'COMPLETED', 'REMOVED', 'EXPIRED'] as const;

export class ListEnrollmentsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ description: 'Cocokkan nama atau email pelajar' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class GrantAccessDto {
  @ApiProperty({ type: [String], format: 'uuid', maxItems: 200 })
  @IsArray()
  @ArrayNotEmpty()
  // Batas atas menjaga satu permintaan tetap dapat diselesaikan dalam waktu
  // wajar; pendaftaran massal yang lebih besar sebaiknya lewat impor berkas.
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  userIds!: string[];

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  accessStartsAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  accessEndsAt?: string;
}

export class UpdateAccessWindowDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  accessStartsAt?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  accessEndsAt?: string;
}
