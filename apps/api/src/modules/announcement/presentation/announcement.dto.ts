import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementAudience, AnnouncementStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5000) body!: string;
  @ApiProperty({ enum: AnnouncementAudience })
  @IsEnum(AnnouncementAudience)
  audience!: AnnouncementAudience;
  @ApiPropertyOptional({ format: 'uuid', description: 'Wajib untuk COURSE_LEARNERS' })
  @IsOptional()
  @IsUUID()
  courseId?: string;
  @ApiPropertyOptional({ type: [String], description: 'Wajib untuk SPECIFIC_USERS' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  userIds?: string[];
  @ApiPropertyOptional({ description: 'Kosongkan untuk tampil segera saat diterbitkan' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(5000) body?: string;
  @ApiPropertyOptional({ enum: AnnouncementAudience })
  @IsOptional()
  @IsEnum(AnnouncementAudience)
  audience?: AnnouncementAudience;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() courseId?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  userIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() publishedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
}

export class ListAnnouncementQueryDto {
  @ApiPropertyOptional({ enum: AnnouncementStatus })
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;
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

export class LearnerAnnouncementQueryDto {
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

export class LearnerAnnouncementDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  publishedAt!: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  endsAt!: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  readAt!: Date | null;
}

class AnnouncementCourseRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
}

class AnnouncementCreatorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
}

class AnnouncementCountDto {
  @ApiProperty() targets!: number;
  @ApiProperty() readState!: number;
}

/**
 * Bentuk daftar pengumuman sisi Master.
 *
 * Sebelumnya endpoint-nya tidak berdekorator sama sekali, sehingga bentuknya
 * tidak pernah masuk ke OpenAPI dan web menuliskan ulang interface-nya dengan
 * tangan — perubahan di sini tidak akan pernah tertangkap saat typecheck.
 */
export class AdminAnnouncementDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: AnnouncementAudience }) audience!: AnnouncementAudience;
  @ApiProperty({ enum: AnnouncementStatus }) status!: AnnouncementStatus;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  publishedAt!: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  endsAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiPropertyOptional({ type: AnnouncementCourseRefDto, nullable: true })
  course!: AnnouncementCourseRefDto | null;
  @ApiProperty({ type: AnnouncementCreatorDto }) creator!: AnnouncementCreatorDto;
  @ApiProperty({ type: AnnouncementCountDto }) _count!: AnnouncementCountDto;
}

export class AnnouncementUnreadCountDto {
  @ApiProperty() unread!: number;
}

export class AnnouncementReadDto {
  @ApiProperty({ format: 'uuid' }) announcementId!: string;
  @ApiProperty({ format: 'date-time' }) readAt!: Date;
}
