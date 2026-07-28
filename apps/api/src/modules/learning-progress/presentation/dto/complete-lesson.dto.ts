import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class CompletionEvidenceDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 86_400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86_400)
  activeSeconds?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  videoPercentage?: number;
}

export class CompleteLessonDto {
  @ApiPropertyOptional({ description: 'ID sesi belajar di sisi klien' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ type: CompletionEvidenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompletionEvidenceDto)
  completionEvidence?: CompletionEvidenceDto;
}

export class OpenLessonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
