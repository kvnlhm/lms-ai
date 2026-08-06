import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ForumReportStatus, ForumTopicStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
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

export class ListTopicsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() lessonId?: string;
  @ApiPropertyOptional({ enum: ForumTopicStatus })
  @IsOptional()
  @IsEnum(ForumTopicStatus)
  status?: ForumTopicStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) search?: string;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class CreateTopicDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() moduleId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() lessonId?: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}

export class UpdateTopicDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(5000) body?: string;
}

export class ReplyBodyDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5000) body!: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Balasan utama yang sedang ditanggapi.' })
  @IsOptional() @IsUUID() parentReplyId?: string;
}

export class ReportContentDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() topicId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() replyId?: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

// ── Moderasi ──────────────────────────────────────────────

export class ModerationListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() courseId?: string;
  @ApiPropertyOptional({ enum: ForumTopicStatus })
  @IsOptional()
  @IsEnum(ForumTopicStatus)
  status?: ForumTopicStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) search?: string;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class SetTopicStatusDto {
  @ApiProperty({ enum: ForumTopicStatus }) @IsEnum(ForumTopicStatus) status!: ForumTopicStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class SetPinnedDto {
  @ApiProperty() @IsBoolean() isPinned!: boolean;
}

export class SetBestReplyDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  replyId?: string;
}

export class SetReplyHiddenDto {
  @ApiProperty() @IsBoolean() isHidden!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ListReportsQueryDto {
  @ApiPropertyOptional({ enum: ForumReportStatus })
  @IsOptional()
  @IsEnum(ForumReportStatus)
  status?: ForumReportStatus;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ResolveReportDto {
  @ApiProperty({ enum: [ForumReportStatus.ACTIONED, ForumReportStatus.DISMISSED] })
  @IsEnum(ForumReportStatus)
  status!: ForumReportStatus;
}

export class CreateBanDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Kosongkan untuk seluruh forum' })
  @IsOptional()
  @IsUUID()
  courseId?: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason!: string;
  @ApiPropertyOptional({ description: 'Kosongkan untuk berlaku sampai dicabut' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ListBansQueryDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;
}
