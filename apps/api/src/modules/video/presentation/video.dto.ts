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

export class CreateBunnyVideoDto {
  @ApiProperty({
    description: 'GUID video dari dashboard Bunny, atau tautan yang memuatnya.',
    example: 'b4dcc06c-ea97-4547-aa95-c17b7c998297',
  })
  @IsString() @MinLength(1) @MaxLength(500) source!: string;

  @ApiPropertyOptional({ description: 'Bila kosong, judul diambil dari Bunny.' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
}

export class CreateBunnyVideoResultDto {
  @ApiProperty({ format: 'uuid' }) videoAssetId!: string;
  @ApiProperty({ enum: VideoProvider }) provider!: VideoProvider;
  @ApiProperty() providerVideoId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: VideoStatus }) status!: VideoStatus;
}

export class CreatePlaybackSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) deviceId?: string;
}

export class PlaybackWatermarkDto {
  @ApiProperty() text!: string;
  @ApiProperty({ enum: ['MOVING'] }) mode!: 'MOVING';
}

export class PlaybackDrmDto {
  @ApiProperty() enabled!: boolean;
  @ApiProperty() type!: string;
}

/**
 * Bentuk sesi pemutaran.
 *
 * Endpoint ini dulu tidak mendokumentasikan responsnya sama sekali, sehingga
 * web menulis ulang bentuknya dengan tangan — dan `kind: 'HLS'` yang lahir
 * bersama Bunny tidak pernah sampai ke kontrak.
 */
export class PlaybackSessionDto {
  @ApiProperty({ format: 'uuid' }) playbackSessionId!: string;
  @ApiProperty({ enum: VideoProvider }) provider!: VideoProvider;
  @ApiProperty() providerVideoId!: string;
  @ApiProperty({
    enum: ['FILE', 'EMBED', 'HLS'],
    description:
      'FILE: berkas dialirkan server ini. EMBED: pemutar penyedia luar. HLS: playlist dari CDN penyedia, diputar pemutar kita sendiri.',
  })
  kind!: 'FILE' | 'EMBED' | 'HLS';
  @ApiProperty({ type: String, nullable: true }) playbackUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) embedUrl!: string | null;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ type: PlaybackDrmDto }) drm!: PlaybackDrmDto;
  @ApiProperty({ type: PlaybackWatermarkDto }) watermark!: PlaybackWatermarkDto;
}

export class VideoUploadHeadersDto {
  @ApiProperty({ example: 'video/mp4' }) 'Content-Type'!: string;
  @ApiProperty({ example: '10485760' }) 'Content-Length'!: string;
}

export class VideoUploadIntentResultDto {
  @ApiProperty({ format: 'uuid' }) videoAssetId!: string;
  @ApiProperty({ enum: VideoProvider }) provider!: VideoProvider;
  @ApiProperty() providerVideoId!: string;
  @ApiProperty({ description: 'Tujuan unggahan; berkasnya dikirim lewat PUT.' }) uploadUrl!: string;
  @ApiProperty({ example: 'PUT' }) method!: string;
  @ApiProperty({ type: VideoUploadHeadersDto }) headers!: VideoUploadHeadersDto;
}

export class CreateYoutubeVideoResultDto {
  @ApiProperty({ format: 'uuid' }) videoAssetId!: string;
  @ApiProperty({ enum: VideoProvider }) provider!: VideoProvider;
  @ApiProperty({ enum: VideoStatus }) status!: VideoStatus;
  @ApiProperty() youtubeVideoId!: string;
  @ApiProperty({ type: String, nullable: true }) sourceUrl!: string | null;
}

export class LessonVideoMutationDto {
  @ApiProperty({ format: 'uuid' }) videoAssetId!: string;
  @ApiPropertyOptional({ enum: VideoStatus }) status?: VideoStatus;
  @ApiPropertyOptional({ description: 'Benar bila aset dilepas atau dihapus.' }) detached?: boolean;
  @ApiPropertyOptional() deleted?: boolean;
}
