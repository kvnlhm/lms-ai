import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CONTENT_TYPES = ['VIDEO', 'TEXT', 'PDF', 'EXTERNAL_LINK'];
const ENROLLMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'REMOVED', 'EXPIRED'];

export class CourseCategoryDto {
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class CourseEnrollmentSummaryDto {
  @ApiProperty({ enum: ENROLLMENT_STATUSES }) status!: string;
  @ApiProperty({ example: 25.5 }) progressPercent!: number;
}

export class CourseListItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) thumbnailUrl!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiProperty({ enum: LEVELS }) level!: string;
  @ApiProperty() estimatedMinutes!: number;
  @ApiPropertyOptional({ type: CourseCategoryDto, nullable: true })
  category!: CourseCategoryDto | null;
  @ApiProperty() moduleCount!: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) publishedAt!: string | null;
  @ApiPropertyOptional({
    type: CourseEnrollmentSummaryDto,
    nullable: true,
    description: 'Null bila pengguna belum terdaftar pada kursus ini.',
  })
  enrollment!: CourseEnrollmentSummaryDto | null;
}

export class CourseSyllabusLessonDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) thumbnailUrl!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty() estimatedMinutes!: number;
  @ApiProperty({ enum: CONTENT_TYPES }) contentType!: string;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty() isPreview!: boolean;
}

export class CourseSyllabusModuleDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty() estimatedMinutes!: number;
  @ApiProperty() lessonCount!: number;
  @ApiProperty({ type: CourseSyllabusLessonDto, isArray: true })
  lessons!: CourseSyllabusLessonDto[];
}

export class CourseAccessDto {
  @ApiProperty() enrolled!: boolean;
  @ApiPropertyOptional({ enum: ENROLLMENT_STATUSES, nullable: true }) status!: string | null;
  @ApiProperty() progressPercent!: number;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) lastLessonId!: string | null;
}

export class CourseDetailDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: LEVELS }) level!: string;
  @ApiProperty() estimatedMinutes!: number;
  @ApiPropertyOptional({ type: CourseCategoryDto, nullable: true })
  category!: CourseCategoryDto | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) publishedAt!: string | null;
  @ApiProperty({ type: CourseSyllabusModuleDto, isArray: true })
  modules!: CourseSyllabusModuleDto[];
  @ApiProperty({ type: CourseAccessDto }) access!: CourseAccessDto;
}
