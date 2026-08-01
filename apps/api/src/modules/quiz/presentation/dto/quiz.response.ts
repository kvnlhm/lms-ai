import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const QUESTION_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'];

// ── Sisi Master ─────────────────────────────────────────────

export class AdminQuizOptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() text!: string;
  @ApiProperty({ description: 'Kunci jawaban; hanya muncul pada endpoint Master.' })
  isCorrect!: boolean;
  @ApiProperty() position!: number;
}

export class AdminQuizQuestionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() prompt!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) explanation!: string | null;
  @ApiProperty({ enum: QUESTION_TYPES }) type!: string;
  @ApiProperty() points!: number;
  @ApiProperty() position!: number;
  @ApiProperty({ type: AdminQuizOptionDto, isArray: true }) options!: AdminQuizOptionDto[];
}

export class AdminQuizDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ example: 70 }) passingScore!: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) maxAttempts!: number | null;
  @ApiProperty() showFeedback!: boolean;
  @ApiProperty({ description: 'Jumlah percobaan yang sudah tercatat dari seluruh pelajar.' })
  attemptCount!: number;
  @ApiProperty() totalPoints!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: AdminQuizQuestionDto, isArray: true }) questions!: AdminQuizQuestionDto[];
}

// ── Sisi Pelajar ────────────────────────────────────────────

export class LearnerQuizOptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() text!: string;
}

export class LearnerQuizQuestionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() prompt!: string;
  @ApiProperty({ enum: QUESTION_TYPES }) type!: string;
  @ApiProperty() points!: number;
  @ApiProperty() position!: number;
  @ApiProperty({
    type: LearnerQuizOptionDto,
    isArray: true,
    description: 'Tanpa penanda benar atau salah.',
  })
  options!: LearnerQuizOptionDto[];
}

export class LearnerQuizDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ example: 70 }) passingScore!: number;
  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Null berarti tanpa batas.' })
  maxAttempts!: number | null;
  @ApiProperty() showFeedback!: boolean;
  @ApiProperty() totalPoints!: number;
  @ApiProperty() attemptsUsed!: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) attemptsLeft!: number | null;
  @ApiProperty() passed!: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true }) bestScorePercent!: number | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastAttemptAt!: string | null;
  @ApiProperty({ type: LearnerQuizQuestionDto, isArray: true })
  questions!: LearnerQuizQuestionDto[];
}

export class QuizReviewItemDto {
  @ApiProperty({ format: 'uuid' }) questionId!: string;
  @ApiProperty() prompt!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) explanation!: string | null;
  @ApiProperty() isCorrect!: boolean;
  @ApiProperty() earnedPoints!: number;
  @ApiProperty() points!: number;
  @ApiProperty({ type: String, isArray: true, format: 'uuid' }) selectedOptionIds!: string[];
  @ApiProperty({ type: String, isArray: true, format: 'uuid' }) correctOptionIds!: string[];
}

export class QuizAttemptResultDto {
  @ApiProperty() attemptNumber!: number;
  @ApiProperty({ example: 83.33 }) scorePercent!: number;
  @ApiProperty() earnedPoints!: number;
  @ApiProperty() totalPoints!: number;
  @ApiProperty() passingScore!: number;
  @ApiProperty() passed!: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true }) attemptsLeft!: number | null;
  @ApiProperty({ description: 'Benar bila kelulusan ini menandai pelajarannya selesai.' })
  lessonCompleted!: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true }) courseProgress!: number | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  nextLessonId!: string | null;
  @ApiPropertyOptional({
    type: QuizReviewItemDto,
    isArray: true,
    nullable: true,
    description: 'Null bila Master mematikan umpan balik untuk kuis ini.',
  })
  review!: QuizReviewItemDto[] | null;
}
