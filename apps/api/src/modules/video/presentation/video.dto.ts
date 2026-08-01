import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

// Tidak ada `lessonId` pada kedua DTO di bawah: unggahan dan tautan YouTube
// masuk ke perpustakaan, lalu dipasang ke pelajaran lewat endpoint terpisah.
// Itulah yang memungkinkan satu berkas dipakai banyak pelajaran.
export class CreateVideoUploadIntentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @ApiProperty({ example: 'lesson-01.mp4' }) @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty({ example: 'video/mp4' }) @IsString() mimeType!: string;
  @ApiProperty() @IsInt() @Min(1) sizeBytes!: number;
}

export class AttachLessonVideoDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() videoAssetId!: string;
}

export class CreateYoutubeVideoDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  @IsString()
  @MaxLength(500)
  url!: string;
}

export class CreatePlaybackSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) deviceId?: string;
}
