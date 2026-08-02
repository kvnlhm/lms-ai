import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoProvider, VideoStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Tiga yang pertama sama persis dengan tab penyaring di halaman perpustakaan.
 * `AVAILABLE` dipakai pemilih video saat menyusun pelajaran: aset yang masih
 * diunggah akan ditolak server, jadi menawarkannya hanya mengundang klik yang
 * gagal.
 */
export const VIDEO_LIBRARY_FILTERS = ['USED', 'ORPHAN', 'PROBLEM', 'AVAILABLE'] as const;
export type VideoLibraryFilter = (typeof VIDEO_LIBRARY_FILTERS)[number];

export class ListVideoLibraryQueryDto {
  @ApiPropertyOptional({ description: 'Judul, nama berkas, atau pelajaran yang memakainya' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: VIDEO_LIBRARY_FILTERS })
  @IsOptional()
  @IsIn(VIDEO_LIBRARY_FILTERS)
  filter?: VideoLibraryFilter;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class VideoLibraryUsageDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty() lessonTitle!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty() courseTitle!: string;
}

export class VideoLibraryItemDto {
  @ApiProperty({ format: 'uuid' }) videoAssetId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: VideoProvider }) provider!: VideoProvider;
  @ApiProperty({ enum: VideoStatus }) status!: VideoStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) originalName!: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'String, bukan angka: ukuran berkas video melampaui batas aman JSON.',
  })
  sizeBytes!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) sourceUrl!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: [VideoLibraryUsageDto] }) usedBy!: VideoLibraryUsageDto[];
}

/**
 * Angka-angka yang harus dihitung dari seluruh perpustakaan, bukan dari satu
 * halaman. Dipisah ke endpointnya sendiri justru supaya daftarnya boleh
 * berhalaman tanpa membuat ringkasannya ikut berbohong.
 */
export class VideoLibrarySummaryDto {
  @ApiProperty() total!: number;
  @ApiProperty() used!: number;
  @ApiProperty() orphan!: number;
  @ApiProperty() problem!: number;
  @ApiProperty({ description: 'Jumlah byte di disk kita; video eksternal tidak dihitung.' })
  totalBytes!: string;
}

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
