import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LearningHabitDto {
  @ApiProperty() dailyActiveLearners!: number;
  @ApiProperty() weeklyActiveLearners!: number;
  @ApiProperty() monthlyActiveLearners!: number;
  @ApiProperty({ description: 'Rata-rata jumlah hari berbeda seorang pelajar belajar' })
  averageStudyDaysPerLearner!: number;
  @ApiProperty({ description: 'Rata-rata menit belajar pada hari pelajar itu aktif' })
  averageMinutesPerStudyDay!: number;
  @ApiProperty({ description: 'Pelajar yang belajar pada dua hari berbeda atau lebih' })
  returningLearners!: number;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Selasa' })
  busiestWeekday!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Jam 0-23 waktu server' })
  busiestHour!: number | null;
}

export class RetentionDto {
  @ApiProperty({ description: 'Persen pelajar pekan lalu yang kembali pekan ini' })
  sevenDay!: number;
  @ApiProperty({ description: 'Persen pelajar 30 hari sebelumnya yang kembali' })
  thirtyDay!: number;
}

export class ForumContributorDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty() topics!: number;
  @ApiProperty() replies!: number;
}

export class ForumInsightDto {
  @ApiProperty({ description: 'Persen pelajar berhak yang ikut menulis di forum' })
  participationRate!: number;
  @ApiProperty() contributors!: number;
  @ApiProperty({ description: 'Pelajar dengan enrollment aktif, yaitu yang boleh menulis' })
  eligibleLearners!: number;
  @ApiProperty() topics!: number;
  @ApiProperty() replies!: number;
  @ApiProperty({ type: [ForumContributorDto] }) topContributors!: ForumContributorDto[];
}

export class RiskCountsDto {
  @ApiProperty() LOW!: number;
  @ApiProperty() MEDIUM!: number;
  @ApiProperty() HIGH!: number;
}

export class LearnerRiskDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] }) level!: 'LOW' | 'MEDIUM' | 'HIGH';
  @ApiProperty({ description: 'Alasan risk level, sesuai PRD 8.6' }) reason!: string;
  @ApiPropertyOptional({ type: Number, nullable: true }) daysInactive!: number | null;
  @ApiProperty() averageProgress!: number;
}

export class RiskBoardDto {
  @ApiProperty({ type: RiskCountsDto }) counts!: RiskCountsDto;
  @ApiProperty({ type: [LearnerRiskDto], description: 'Hanya MEDIUM dan HIGH, maksimal 50' })
  learners!: LearnerRiskDto[];
}

export class LearnerInsightsDto {
  @ApiProperty() periodDays!: number;
  @ApiProperty({ type: LearningHabitDto }) habit!: LearningHabitDto;
  @ApiProperty({ type: RetentionDto }) retention!: RetentionDto;
  @ApiProperty({ type: ForumInsightDto }) forum!: ForumInsightDto;
  @ApiProperty({ type: RiskBoardDto }) risk!: RiskBoardDto;
}
