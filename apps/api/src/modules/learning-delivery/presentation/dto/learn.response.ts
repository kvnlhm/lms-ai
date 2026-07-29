import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CONTENT_TYPES = ['VIDEO', 'TEXT', 'PDF', 'EXTERNAL_LINK'];
const LESSON_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
const COMPLETION_RULES = ['MANUAL', 'OPENED', 'MINIMUM_ACTIVE_SECONDS', 'VIDEO_PERCENTAGE'];

export class LearnCourseSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiProperty() estimatedMinutes!: number;
}

export class LearnLessonItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() position!: number;
  @ApiProperty({ enum: CONTENT_TYPES }) contentType!: string;
  @ApiProperty() estimatedMinutes!: number;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty({ enum: LESSON_STATUSES }) status!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) completedAt!: string | null;
}

export class LearnModuleDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty({ type: LearnLessonItemDto, isArray: true }) lessons!: LearnLessonItemDto[];
}

export class LearnProgressDto {
  @ApiProperty({ example: 42.11 }) percent!: number;
  @ApiProperty() requiredLessonsTotal!: number;
  @ApiProperty() requiredLessonsCompleted!: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) lastActivityAt!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) completedAt!: string | null;
}

export class LearnCourseResponseDto {
  @ApiProperty({ type: LearnCourseSummaryDto }) course!: LearnCourseSummaryDto;
  @ApiProperty({ type: LearnModuleDto, isArray: true }) modules!: LearnModuleDto[];
  @ApiProperty({ type: LearnProgressDto }) progress!: LearnProgressDto;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) lastLessonId!: string | null;
  @ApiPropertyOptional({ type: String,
    format: 'uuid',
    nullable: true,
    description: 'Pelajaran pertama yang belum selesai; null bila semua sudah selesai.',
  })
  nextLessonId!: string | null;
  @ApiProperty() totalLessons!: number;
}

export class LessonContentDto {
  @ApiPropertyOptional({ type: String, nullable: true }) text!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) externalUrl!: string | null;
  @ApiPropertyOptional({ type: String,
    nullable: true,
    description: 'URL bertanda tangan untuk media; belum tersedia pada walking skeleton.',
  })
  streamUrl!: string | null;
}

export class LearnLessonResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: CONTENT_TYPES }) contentType!: string;
  @ApiProperty({ type: LessonContentDto }) content!: LessonContentDto;
  @ApiProperty({ format: 'uuid' }) moduleId!: string;
  @ApiProperty() moduleTitle!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty({ enum: COMPLETION_RULES }) completionRule!: string;
  @ApiProperty({ enum: LESSON_STATUSES }) status!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) previousLessonId!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextLessonId!: string | null;
  @ApiProperty() courseProgress!: number;
}
