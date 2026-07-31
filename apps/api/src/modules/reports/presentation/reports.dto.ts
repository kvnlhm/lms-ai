import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { REPORT_KEYS } from '../application/report.service';

export class ReportQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() courseId?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;

  @ApiPropertyOptional({
    type: Number,
    default: 30,
    description: 'Ambang hari tanpa aktivitas; hanya untuk laporan pengguna tidak aktif',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  inactiveDays?: number;
}

export class ReportKeyParamDto {
  @ApiProperty({ enum: REPORT_KEYS })
  @IsIn(REPORT_KEYS as unknown as string[])
  reportKey!: string;
}

export class ReportCatalogItemDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
}

export class ReportCatalogDto {
  @ApiProperty({ type: [ReportCatalogItemDto] }) reports!: ReportCatalogItemDto[];
}
