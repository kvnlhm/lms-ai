import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DashboardAnalyticsQueryDto {
  @ApiPropertyOptional({ type: Number, default: 30, minimum: 7, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  days = 30;
}

export class AnalyticsSummaryDto {
  @ApiProperty() activeLearners!: number;
  @ApiProperty() lessonOpens!: number;
  @ApiProperty() lessonCompletions!: number;
  @ApiProperty() learningMinutes!: number;
}

export class CourseAnalyticsRankDto {
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) thumbnailUrl!: string | null;
  @ApiProperty() lessonOpens!: number;
  @ApiProperty() lessonCompletions!: number;
  @ApiProperty() activeLearners!: number;
  @ApiProperty() enrollmentCount!: number;
  @ApiProperty() averageProgress!: number;
  @ApiProperty() completionRate!: number;
}

export class DailyLearningActivityDto {
  @ApiProperty({ format: 'date-time' }) date!: Date;
  @ApiProperty() lessonOpens!: number;
  @ApiProperty() lessonCompletions!: number;
  @ApiProperty() activeLearners!: number;
}

export class DashboardAnalyticsDto {
  @ApiProperty() periodDays!: number;
  @ApiProperty({ type: AnalyticsSummaryDto }) summary!: AnalyticsSummaryDto;
  @ApiProperty({ type: CourseAnalyticsRankDto, isArray: true }) courses!: CourseAnalyticsRankDto[];
  @ApiProperty({ type: DailyLearningActivityDto, isArray: true }) daily!: DailyLearningActivityDto[];
}
