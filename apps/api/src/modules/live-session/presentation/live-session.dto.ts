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
  MinLength,
} from 'class-validator';

export class CreateLiveSessionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() courseId!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiProperty({ example: 'https://zoom.us/j/1234567890' })
  @IsString()
  @MaxLength(500)
  joinUrl!: string;
  @ApiProperty({ example: '2026-08-05T13:00:00Z' }) @IsDateString() startsAt!: string;
  @ApiProperty({ type: Number, default: 60, minimum: 5, maximum: 600 })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes = 60;
}

export class UpdateLiveSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) joinUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional({ minimum: 5, maximum: 600 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;
}

export class ListLiveSessionQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() courseId?: string;
}

export class LearnerLiveSessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() startsAt!: Date;
  @ApiProperty() endsAt!: Date;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ enum: ['UPCOMING', 'LIVE', 'ENDED'] })
  status!: 'UPCOMING' | 'LIVE' | 'ENDED';
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Kosong setelah sesi berakhir',
  })
  joinUrl!: string | null;
}

export class LiveSessionCourseRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
}

/** Bentuk sesi langsung sebagaimana dilihat Master, termasuk yang dibatalkan. */
export class AdminLiveSessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() joinUrl!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: Date;
  @ApiProperty() durationMinutes!: number;
  @ApiPropertyOptional({ type: Date, format: 'date-time', nullable: true })
  cancelledAt!: Date | null;
  @ApiProperty({ type: LiveSessionCourseRefDto }) course!: LiveSessionCourseRefDto;
}
