import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CommunityPageQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class CommunityPostBodyDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}

export class CreateCommunityChannelDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiPropertyOptional({ description: 'Huruf kecil, angka, dan tanda hubung.' })
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) description?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isReadOnly?: boolean;
}

export class UpdateCommunityChannelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isReadOnly?: boolean;
}

export class CommunityChannelDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() position!: number;
  @ApiProperty() isReadOnly!: boolean;
  @ApiProperty() postCount!: number;
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
  @ApiProperty() isReadOnly!: boolean;
}

export class CommunityCommentDto {
  @ApiProperty() id!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: CommunityPersonDto }) author!: CommunityPersonDto;
}

export class CommunityPostDto {
  @ApiProperty() id!: string;
  @ApiProperty() body!: string;
  @ApiProperty() isPinned!: boolean;
  @ApiProperty() commentCount!: number;
  @ApiProperty() reactionCount!: number;
  @ApiProperty() reactedByMe!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() lastActivityAt!: Date;
  @ApiProperty({ type: CommunityPersonDto }) author!: CommunityPersonDto;
  @ApiProperty({ type: CommunityPostChannelDto }) channel!: CommunityPostChannelDto;
  @ApiProperty({ type: [CommunityCommentDto] }) comments!: CommunityCommentDto[];
}

export class CommunityReactionResultDto {
  @ApiProperty() reacted!: boolean;
  @ApiProperty() reactionCount!: number;
}
