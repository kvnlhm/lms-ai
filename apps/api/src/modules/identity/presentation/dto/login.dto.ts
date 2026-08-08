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

export class GoogleLoginDto {
  /**
   * ID token dari Google Identity Services di browser.
   *
   * Batas panjangnya longgar dan sengaja tidak diperketat menjadi bentuk JWT:
   * yang menentukan sah atau tidaknya adalah verifikasi tanda tangan terhadap
   * kunci Google, bukan tebakan bentuk di lapisan ini.
   */
  @ApiProperty({ description: 'ID token dari tombol Google di browser.' })
  @IsString()
  @MinLength(16)
  @MaxLength(4096)
  idToken!: string;

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

/**
 * Pendaftaran gratis: nama, email, sandi.
 *
 * Tanpa nomor telepon dan tanpa kolom lain. Setiap kolom tambahan pada
 * formulir gratis adalah alasan tambahan untuk menutup tab — dan yang dibutuhkan
 * untuk melihat katalog memang hanya sebuah alamat yang terbukti.
 */
export class FreeRegistrationDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2, { message: 'fullName minimal 2 karakter' })
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'pelajar@akademionline.id' })
  @IsEmail({}, { message: 'email harus berupa alamat email yang valid' })
  @MaxLength(255)
  email!: string;

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

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  token!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'pelajar@akademionline.id' })
  @IsEmail({}, { message: 'email harus berupa alamat email yang valid' })
  @MaxLength(255)
  email!: string;
}

export class UpdateCurrentUserDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'fullName minimal 2 karakter' })
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12, { message: 'currentPassword minimal 12 karakter' })
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12, { message: 'newPassword minimal 12 karakter' })
  @MaxLength(128)
  newPassword!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPasswordConfirmation!: string;
}
