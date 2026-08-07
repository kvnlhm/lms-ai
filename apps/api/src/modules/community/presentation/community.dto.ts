import { CommunityChannelType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CommunityPageQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class CommunityPostBodyDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5000) body!: string;
  @ApiPropertyOptional({ description: 'Judul item; wajib untuk post dalam sub-channel CHECKLIST.' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) checklistTitle?: string;
}

export class CreateCommunityChannelDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiPropertyOptional({ description: 'Huruf kecil, angka, dan tanda hubung.' })
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) description?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
  @ApiProperty({ description: 'Nama sub-channel pertama.' }) @IsString() @MinLength(2) @MaxLength(80) subchannelName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) subchannelDescription?: string;
  @ApiPropertyOptional({ enum: CommunityChannelType, default: CommunityChannelType.CHAT })
  @IsOptional() @IsEnum(CommunityChannelType) subchannelType?: CommunityChannelType;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isReadOnly?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() allowReplies?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() showInSidebar?: boolean;
}

export class UpdateCommunityChannelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showInSidebar?: boolean;
}

export class CreateCommunitySubchannelDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiPropertyOptional({ description: 'Huruf kecil, angka, dan tanda hubung.' })
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) description?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
  @ApiPropertyOptional({ enum: CommunityChannelType, default: CommunityChannelType.CHAT })
  @IsOptional() @IsEnum(CommunityChannelType) type?: CommunityChannelType;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isReadOnly?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() allowReplies?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() showInSidebar?: boolean;
}

export class UpdateCommunitySubchannelDto extends PartialType(CreateCommunitySubchannelDto) {}

export class CommunitySubchannelDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty({ enum: CommunityChannelType }) type!: CommunityChannelType;
  @ApiProperty() isReadOnly!: boolean;
  @ApiProperty() allowReplies!: boolean;
  @ApiProperty() postCount!: number;
  /**
   * Item checklist yang sudah diselesaikan pengguna yang sedang meminta, dipakai
   * feed untuk menampilkan progres tanpa menghitung dari tulisan yang termuat.
   *
   * Hanya diisi pada endpoint daftar channel, dan hanya untuk sub-channel
   * bertipe `CHECKLIST`. Tipe lain selalu 0, begitu pula balasan endpoint
   * pembuatan dan penyuntingan sub-channel — di sana nilainya tidak berlaku dan
   * tidak boleh dibaca sebagai progres.
   */
  @ApiProperty() checklistCompletedCount!: number;
  @ApiProperty() showInSidebar!: boolean;
}

export class CommunityChannelDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty() showInSidebar!: boolean;
  @ApiProperty({ type: [CommunitySubchannelDto] }) subchannels!: CommunitySubchannelDto[];
}

export class AdminCommunityChannelDto extends CommunityChannelDto {
  @ApiProperty({ type: Date, nullable: true }) archivedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class CommunityPersonDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
}

export class CommunityPostChannelDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CommunityChannelType }) type!: CommunityChannelType;
  @ApiProperty() isReadOnly!: boolean;
  @ApiProperty() allowReplies!: boolean;
  @ApiProperty() groupSlug!: string;
  @ApiProperty() groupName!: string;
}

export class CommunityCommentDto {
  @ApiProperty() id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: Date, nullable: true, description: 'Terisi bila tulisannya pernah diubah.' })
  editedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ description: 'Hanya penulisnya sendiri.' }) canEdit!: boolean;
  @ApiProperty({ description: 'Penulisnya sendiri, atau pemegang izin moderasi.' }) canDelete!: boolean;
  @ApiProperty({ type: CommunityPersonDto }) author!: CommunityPersonDto;
}

export class CommunityPostDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Judul khusus item checklist.' }) checklistTitle!: string | null;
  @ApiProperty() body!: string;
  @ApiProperty() isPinned!: boolean;
  @ApiProperty() commentCount!: number;
  @ApiProperty() reactionCount!: number;
  @ApiProperty() reactedByMe!: boolean;
  @ApiProperty({ description: 'Status item checklist untuk pengguna dari session.' }) completedByMe!: boolean;
  @ApiProperty({ type: Date, nullable: true, description: 'Terisi bila tulisannya pernah diubah.' })
  editedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() lastActivityAt!: Date;
  @ApiProperty({ description: 'Hanya penulisnya sendiri.' }) canEdit!: boolean;
  @ApiProperty({ description: 'Penulisnya sendiri, atau pemegang izin moderasi.' }) canDelete!: boolean;
  @ApiProperty({ description: 'Hanya pemegang izin moderasi; menyematkan bukan hak penulis.' })
  canPin!: boolean;
  @ApiProperty({ type: CommunityPersonDto }) author!: CommunityPersonDto;
  @ApiProperty({ type: CommunityPostChannelDto }) channel!: CommunityPostChannelDto;
  @ApiProperty({ type: [CommunityCommentDto] }) comments!: CommunityCommentDto[];
  @ApiProperty({ type: () => CommunityAttachmentDto, nullable: true }) attachment!: CommunityAttachmentDto | null;
}

export class CommunityAttachmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() originalName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty({ description: 'Ukuran byte sebagai string agar aman untuk JSON.' }) sizeBytes!: string;
  @ApiProperty() createdAt!: Date;
}

export class CommunityChecklistItemDto extends CommunityPostDto {
  @ApiProperty({ type: String, nullable: true }) previousPostId!: string | null;
  @ApiProperty({ type: String, nullable: true }) nextPostId!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty() total!: number;
}

export class SetCommunityPinnedDto {
  @ApiProperty() @IsBoolean() isPinned!: boolean;
}

export class CommunityReactionResultDto {
  @ApiProperty() reacted!: boolean;
  @ApiProperty() reactionCount!: number;
}

export class SetCommunityChecklistDto {
  @ApiProperty() @IsBoolean() completed!: boolean;
}

export class CommunityChecklistResultDto {
  @ApiProperty() completed!: boolean;
}
