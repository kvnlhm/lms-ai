import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const CONTENT_TYPES = ['VIDEO', 'TEXT', 'PDF', 'EXTERNAL_LINK'];
const COMPLETION_RULES = ['MANUAL', 'OPENED', 'MINIMUM_ACTIVE_SECONDS', 'VIDEO_PERCENTAGE'];

export class AdminCategoryDto {
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class AdminCourseListItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiProperty({ enum: LEVELS }) level!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty() estimatedMinutes!: number;
  @ApiPropertyOptional({ type: AdminCategoryDto, nullable: true })
  category!: AdminCategoryDto | null;
  @ApiProperty() moduleCount!: number;
  @ApiProperty() lessonCount!: number;
  @ApiProperty() enrollmentCount!: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

/** Bentuk kursus yang dikembalikan tindakan tulis. */
export class AdminCourseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: LEVELS }) level!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty() estimatedMinutes!: number;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) categoryId!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class AdminLessonDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) moduleId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: CONTENT_TYPES }) contentType!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) textContent!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) externalUrl!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty() estimatedMinutes!: number;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty() isPreview!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ enum: COMPLETION_RULES }) completionRule!: string;
}

export class AdminModuleDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty() estimatedMinutes!: number;
  @ApiProperty() isActive!: boolean;
}

export class AdminModuleWithLessonsDto extends AdminModuleDto {
  @ApiProperty({ type: AdminLessonDto, isArray: true }) lessons!: AdminLessonDto[];
}

export class AdminCourseDetailDto extends AdminCourseDto {
  @ApiPropertyOptional({ type: AdminCategoryDto, nullable: true })
  category!: AdminCategoryDto | null;
  @ApiProperty({ type: AdminModuleWithLessonsDto, isArray: true })
  modules!: AdminModuleWithLessonsDto[];
}

export class ReorderResultDto {
  @ApiProperty({ example: 3 }) reordered!: number;
}
