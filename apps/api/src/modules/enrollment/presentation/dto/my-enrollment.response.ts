import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ENROLLMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'REMOVED', 'EXPIRED'];
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export class EnrolledCourseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) thumbnailUrl!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiProperty({ enum: LEVELS }) level!: string;
  @ApiProperty() estimatedMinutes!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) category!: string | null;
}

export class EnrollmentProgressDto {
  @ApiProperty() percent!: number;
  @ApiProperty() requiredLessonsTotal!: number;
  @ApiProperty() requiredLessonsCompleted!: number;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) lastLessonId!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) lastActivityAt!: string | null;
}

export class MyEnrollmentDto {
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ enum: ENROLLMENT_STATUSES }) status!: string;
  @ApiProperty({ format: 'date-time' }) enrolledAt!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) accessEndsAt!: string | null;
  @ApiProperty({ type: EnrolledCourseDto }) course!: EnrolledCourseDto;
  @ApiProperty({ type: EnrollmentProgressDto }) progress!: EnrollmentProgressDto;
}
