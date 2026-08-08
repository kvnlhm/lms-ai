import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PERMISSIONS, ROLES } from '@lms/contracts';

const ROLE_CODES = Object.values(ROLES);
const PERMISSION_CODES = Object.values(PERMISSIONS);

export class LoginUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ enum: ROLE_CODES }) role!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }) status!: string;
  @ApiProperty({ description: 'Benar bila login harus dilanjutkan dengan verifikasi MFA.' })
  requiresMfa!: boolean;
  @ApiProperty({ description: 'Benar bila Master harus mendaftarkan TOTP terlebih dahulu.' })
  mfaSetupRequired!: boolean;
}

export class LoginResponseDto {
  @ApiProperty({ type: LoginUserDto }) user!: LoginUserDto;
}

export class CurrentUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) bio!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ enum: ROLE_CODES }) role!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }) status!: string;
  @ApiProperty({ enum: PERMISSION_CODES, isArray: true }) permissions!: string[];
  @ApiProperty({ description: 'Benar saat Master sedang melihat aplikasi sebagai Pelajar.' })
  isImpersonating!: boolean;
}

export class LogoutAllResponseDto {
  @ApiProperty({ example: 3 }) revokedSessions!: number;
}

export class PasswordChangedResponseDto {
  @ApiProperty({ example: true }) changed!: boolean;
}

export class AvatarUploadResponseDto {
  @ApiProperty() avatarUrl!: string;
}

/**
 * Sengaja tidak membawa informasi apa pun tentang akunnya. Nilainya selalu
 * `true`, baik alamatnya terdaftar maupun tidak.
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({ example: true }) requested!: boolean;
}

export class DeviceSessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) deviceName!: string | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty({ format: 'date-time' }) lastUsedAt!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

export class InvitationAcceptedDto {
  @ApiProperty({ example: true }) accepted!: boolean;
}

export class PasswordResetDto {
  @ApiProperty({ example: true }) reset!: boolean;
}

/**
 * Balasan pendaftaran gratis.
 *
 * Seperti `ForgotPasswordResponseDto`, ia sengaja tidak membawa keterangan apa
 * pun tentang akunnya: nilainya selalu `true`, terdaftar maupun tidak. Balasan
 * yang berbeda akan mengubah formulir pendaftaran menjadi alat memeriksa siapa
 * saja yang punya akun di sini.
 */
export class FreeRegistrationResponseDto {
  @ApiProperty({ example: true }) registered!: boolean;
}

export class EmailVerifiedResponseDto {
  @ApiProperty({ example: true }) verified!: boolean;
}

/**
 * Rahasia TOTP hanya dikirim sekali, saat penyiapan. Sesudah dikonfirmasi ia
 * tidak pernah keluar lagi dari server.
 */
export class MfaSetupDto {
  @ApiProperty({ description: 'Base32; ditampilkan sekali untuk dicatat manual.' })
  secret!: string;
  @ApiProperty({ description: 'URI otpauth:// untuk dipindai aplikasi authenticator.' })
  otpauthUrl!: string;
}
