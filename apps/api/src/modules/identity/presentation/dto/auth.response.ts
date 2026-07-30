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
}

export class LogoutAllResponseDto {
  @ApiProperty({ example: 3 }) revokedSessions!: number;
}

export class DeviceSessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) deviceName!: string | null;
  @ApiProperty({ format: 'date-time' }) lastUsedAt!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
