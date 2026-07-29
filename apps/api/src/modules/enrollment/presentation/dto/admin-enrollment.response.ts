import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ENROLLMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'REMOVED', 'EXPIRED'];
const OUTCOMES = [
  'ENROLLED',
  'REACTIVATED',
  'ALREADY_ENROLLED',
  'USER_NOT_FOUND',
  'USER_INACTIVE',
];

export class EnrolledLearnerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }) status!: string;
}

export class EnrollmentProgressSummaryDto {
  @ApiProperty() percent!: number;
  @ApiProperty() requiredLessonsTotal!: number;
  @ApiProperty() requiredLessonsCompleted!: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastActivityAt!: string | null;
}

export class AdminEnrollmentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ENROLLMENT_STATUSES }) status!: string;
  @ApiProperty({ format: 'date-time' }) enrolledAt!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  accessStartsAt!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  accessEndsAt!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;
  @ApiProperty({ type: EnrolledLearnerDto }) user!: EnrolledLearnerDto;
  @ApiProperty({ type: EnrollmentProgressSummaryDto }) progress!: EnrollmentProgressSummaryDto;
}

export class GrantResultDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({
    enum: OUTCOMES,
    description: 'Hasil untuk pengguna ini. Kegagalan satu pengguna tidak membatalkan yang lain.',
  })
  outcome!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  enrollmentId?: string;
}

export class GrantAccessResponseDto {
  @ApiProperty({ type: GrantResultDto, isArray: true }) results!: GrantResultDto[];
}

/** Bentuk enrollment yang dikembalikan tindakan tulis. */
export class EnrollmentMutationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty({ enum: ENROLLMENT_STATUSES }) status!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  accessStartsAt!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  accessEndsAt!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;
}
