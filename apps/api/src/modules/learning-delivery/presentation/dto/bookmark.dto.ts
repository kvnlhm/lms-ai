import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveBookmarkDto {
  @ApiPropertyOptional({ description: 'Catatan pribadi; tidak pernah terlihat pengguna lain' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BookmarkStateDto {
  @ApiProperty() bookmarked!: boolean;
}

export class BookmarkDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty() lessonTitle!: string;
  @ApiProperty() moduleTitle!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty() courseTitle!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}
