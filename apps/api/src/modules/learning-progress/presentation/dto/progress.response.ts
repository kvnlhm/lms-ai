import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const LESSON_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
const ENROLLMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'REMOVED', 'EXPIRED'];

export class OpenLessonResponseDto {
  @ApiProperty({ enum: LESSON_STATUSES }) status!: string;
}

export class CompleteLessonResponseDto {
  @ApiProperty({ enum: LESSON_STATUSES, example: 'COMPLETED' }) lessonStatus!: string;
  @ApiProperty({ example: 26.32, description: 'Progres kursus setelah operasi ini, 0 sampai 100.' })
  courseProgress!: number;
  @ApiProperty({ enum: ENROLLMENT_STATUSES }) courseStatus!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextLessonId!: string | null;
}
