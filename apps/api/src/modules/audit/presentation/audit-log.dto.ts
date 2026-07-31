import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListAuditLogQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() actorUserId?: string;

  @ApiPropertyOptional({ description: 'Cocok berdasarkan awalan, mis. `user.`' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) targetType?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() targetId?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;

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

export class AuditLogActorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class AuditLogEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiProperty() targetType!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) targetId!: string | null;
  @ApiPropertyOptional({ type: AuditLogActorDto, nullable: true })
  actor!: AuditLogActorDto | null;
  @ApiPropertyOptional({ type: Object, nullable: true }) beforeData!: unknown;
  @ApiPropertyOptional({ type: Object, nullable: true }) afterData!: unknown;
  @ApiPropertyOptional({ type: String, nullable: true }) requestId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) userAgent!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class AuditLogActionsDto {
  @ApiProperty({ type: [String] }) actions!: string[];
}
