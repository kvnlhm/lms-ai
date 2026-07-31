import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SEARCH_TYPES } from '../application/search.service';

export class SearchQueryDto {
  @ApiProperty({ description: 'Kata kunci; tidak case-sensitive' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({
    enum: SEARCH_TYPES,
    isArray: true,
    description: 'Batasi ke jenis tertentu; kosong berarti semua',
  })
  @IsOptional()
  // Dikirim sebagai `types=courses,lessons` supaya URL-nya tetap terbaca.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((part) => part.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @IsIn(SEARCH_TYPES as unknown as string[], { each: true })
  types?: string[];

  @ApiPropertyOptional({ type: Number, default: 5, description: 'Hasil maksimum per jenis' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}

export class SearchHitDto {
  @ApiProperty({ enum: SEARCH_TYPES }) type!: string;
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) subtitle!: string | null;
  @ApiProperty({ description: 'Tautan relatif ke objeknya' }) url!: string;
}

export class SearchGroupDto {
  @ApiProperty({ enum: SEARCH_TYPES }) type!: string;
  @ApiProperty({ description: 'Jumlah seluruh kecocokan, bukan hanya yang dikirim' })
  total!: number;
  @ApiProperty({ type: [SearchHitDto] }) items!: SearchHitDto[];
}
