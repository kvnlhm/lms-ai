import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LearningHistoryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;
  @ApiPropertyOptional({ type: Number, default: 20, minimum: 1, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit = 20;
}

export class ContinueCourseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) thumbnailUrl!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
}

export class ContinueLessonDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() contentType!: string;
  @ApiProperty() moduleTitle!: string;
}

export class ContinueLearningDto {
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ type: ContinueCourseDto }) course!: ContinueCourseDto;
  @ApiPropertyOptional({ type: ContinueLessonDto, nullable: true }) lesson!: ContinueLessonDto | null;
  @ApiProperty() progressPercent!: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) lastActivityAt!: Date | null;
}

export class LearningHistoryItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['LESSON_OPENED', 'LESSON_COMPLETED'] }) activityType!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiPropertyOptional({ type: Number, nullable: true }) durationSeconds!: number | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) courseId!: string | null;
  @ApiProperty() courseTitle!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) lessonId!: string | null;
  @ApiProperty() lessonTitle!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) moduleTitle!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) progressAfter!: number | null;
}

export class LearningHistoryPageDto {
  @ApiProperty({ type: LearningHistoryItemDto, isArray: true }) items!: LearningHistoryItemDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) nextCursor!: string | null;
}
