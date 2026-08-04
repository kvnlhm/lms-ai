import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  // Query string mengirim "true"/"false" sebagai teks, bukan boolean.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;

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

export class NotificationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: NotificationType }) type!: NotificationType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) linkUrl!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  readAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class UnreadCountDto {
  @ApiProperty() unread!: number;
}

export class MarkAllReadDto {
  @ApiProperty() updated!: number;
}

export class NotificationReadDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) readAt!: Date;
}
