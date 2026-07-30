import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'pelajar@akademionline.id' })
  @IsEmail({}, { message: 'email harus berupa alamat email yang valid' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Pelajar#12345', minLength: 12 })
  @IsString()
  @MinLength(12, { message: 'password minimal 12 karakter' })
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Chrome di macOS' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class MfaCodeDto {
  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12, { message: 'password minimal 12 karakter' })
  @MaxLength(128)
  password!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  passwordConfirmation!: string;
}

export class ResetPasswordDto extends AcceptInvitationDto {}
