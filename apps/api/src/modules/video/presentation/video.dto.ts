import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateVideoUploadIntentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() lessonId!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @ApiProperty({ example: 'lesson-01.mp4' }) @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty({ example: 'video/mp4' }) @IsString() mimeType!: string;
  @ApiProperty() @IsInt() @Min(1) sizeBytes!: number;
}

export class CreatePlaybackSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) deviceId?: string;
}
