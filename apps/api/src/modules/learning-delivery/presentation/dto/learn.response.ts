import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CONTENT_TYPES = ['VIDEO', 'TEXT', 'PDF', 'EXTERNAL_LINK', 'QUIZ'];
const LESSON_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
const COMPLETION_RULES = ['MANUAL', 'OPENED', 'MINIMUM_ACTIVE_SECONDS', 'VIDEO_PERCENTAGE'];

export class LearnCourseSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiProperty() estimatedMinutes!: number;
  @ApiProperty({
    description: 'Benar bila kursus dibuka sebagai pratinjau karena belum terbit.',
  })
  preview!: boolean;
  @ApiProperty({
    description:
      'Benar bila pembacanya berhak atas isi pelajaran. Salah berarti akun gratis: ' +
      'kurikulumnya terlihat, isinya menuntut keanggotaan berbayar (ADR-032).',
  })
  entitled!: boolean;
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
  @ApiProperty({
    description:
      'Benar bila isi pelajaran ini menuntut keanggotaan berbayar yang belum dimiliki. ' +
      'Kurikulumnya tetap terlihat; membukanya dijawab 402 MEMBERSHIP_REQUIRED.',
  })
  locked!: boolean;
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
  @ApiProperty({
    type: Boolean,
    description:
      'Benar bila pelajaran ini punya berkas materi terunggah. URL-nya tidak dikirim: ' +
      'berkasnya diambil lewat endpoint tersendiri yang memeriksa hak.',
  })
  hasMaterial!: boolean;
  @ApiProperty({ format: 'uuid' }) moduleId!: string;
  @ApiProperty() moduleTitle!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty({ enum: COMPLETION_RULES }) completionRule!: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Persentase tontonan yang menyelesaikan pelajaran ini; terisi hanya pada aturan VIDEO_PERCENTAGE. ' +
      'Dikirim agar antarmuka dapat menyebut targetnya, bukan agar antarmuka yang menegakkannya.',
  })
  completionVideoPercentage!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Detik minimum; terisi hanya pada aturan MINIMUM_ACTIVE_SECONDS.',
  })
  completionMinimumSeconds!: number | null;
  @ApiProperty({ enum: LESSON_STATUSES }) status!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) previousLessonId!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextLessonId!: string | null;
  @ApiProperty() courseProgress!: number;
  @ApiProperty({ description: 'Benar bila materi ini sudah ditandai pengguna' })
  bookmarked!: boolean;
}
