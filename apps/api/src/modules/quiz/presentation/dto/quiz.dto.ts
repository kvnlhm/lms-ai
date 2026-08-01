import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const QUESTION_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'] as const;

export class SaveQuizOptionDto {
  @ApiProperty({ example: 'Model bahasa besar' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @ApiProperty({ description: 'Kunci jawaban. Tidak pernah dikirim ke Pelajar.' })
  @IsBoolean()
  isCorrect!: boolean;
}

export class SaveQuizQuestionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Diisi untuk soal yang sudah ada agar riwayat jawabannya tetap menunjuk soal ini.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Apa kepanjangan LLM?' })
  @IsString()
  @MinLength(3)
  @MaxLength(2_000)
  prompt!: string;

  @ApiPropertyOptional({ description: 'Penjelasan yang tampil bersama umpan balik.' })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  explanation?: string;

  @ApiProperty({ enum: QUESTION_TYPES })
  @IsIn(QUESTION_TYPES)
  type!: (typeof QUESTION_TYPES)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  points?: number;

  @ApiProperty({ type: SaveQuizOptionDto, isArray: true, minItems: 2, maxItems: 8 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SaveQuizOptionDto)
  options!: SaveQuizOptionDto[];
}

export class SaveQuizDto {
  @ApiProperty({ minimum: 0, maximum: 100, example: 70 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 1,
    maximum: 20,
    description: 'Batas percobaan. Kosong berarti tanpa batas.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showFeedback?: boolean;

  @ApiProperty({ type: SaveQuizQuestionDto, isArray: true, minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SaveQuizQuestionDto)
  questions!: SaveQuizQuestionDto[];
}

export class SubmitQuizAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId!: string;

  @ApiProperty({ type: String, isArray: true, format: 'uuid', minItems: 1, maxItems: 8 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUUID(undefined, { each: true })
  selectedOptionIds!: string[];
}

export class SubmitQuizDto {
  @ApiProperty({ type: SubmitQuizAnswerDto, isArray: true, minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SubmitQuizAnswerDto)
  answers!: SubmitQuizAnswerDto[];
}
