import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const CONTENT_TYPES = ['VIDEO', 'TEXT', 'PDF', 'EXTERNAL_LINK', 'QUIZ'] as const;
const COMPLETION_RULES = ['MANUAL', 'OPENED', 'MINIMUM_ACTIVE_SECONDS', 'VIDEO_PERCENTAGE'] as const;
const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export class ListAdminCoursesDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateCourseDto {
  @ApiProperty({ example: 'AI untuk Bisnis' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: 'ai-untuk-bisnis' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  // Slug muncul di URL, jadi hanya huruf kecil, angka, dan tanda hubung.
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug hanya boleh berisi huruf kecil, angka, dan tanda hubung',
  })
  slug!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  description?: string;

  @ApiProperty({ enum: LEVELS })
  @IsIn(LEVELS)
  level!: (typeof LEVELS)[number];

  @ApiPropertyOptional({ minimum: 0, maximum: 100_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  estimatedMinutes?: number;
}

export class UpdateCourseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug hanya boleh berisi huruf kecil, angka, dan tanda hubung',
  })
  @MaxLength(160)
  slug?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  description?: string;

  @ApiPropertyOptional({ enum: LEVELS })
  @IsOptional()
  @IsIn(LEVELS)
  level?: (typeof LEVELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  estimatedMinutes?: number;
}

export class CreateModuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  estimatedMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateModuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  estimatedMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLessonDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @ApiProperty({ enum: CONTENT_TYPES })
  @IsIn(CONTENT_TYPES)
  contentType!: (typeof CONTENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  textContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  externalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  estimatedMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: COMPLETION_RULES, default: 'MANUAL' })
  @IsOptional()
  @IsIn(COMPLETION_RULES)
  completionRule?: (typeof COMPLETION_RULES)[number];

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    description:
      'Persentase tontonan yang menyelesaikan pelajaran, untuk aturan VIDEO_PERCENTAGE. ' +
      'Bila kosong, ambang bawaan 90% yang berlaku.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  completionVideoPercentage?: number;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Detik minimum, untuk aturan MINIMUM_ACTIVE_SECONDS. Bila kosong, 60 detik.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  completionMinimumSeconds?: number;
}

export class UpdateLessonDto extends CreateLessonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  override title!: string;

  @ApiPropertyOptional({ enum: CONTENT_TYPES })
  @IsOptional()
  @IsIn(CONTENT_TYPES)
  override contentType!: (typeof CONTENT_TYPES)[number];
}

export class ReorderDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids!: string[];
}
