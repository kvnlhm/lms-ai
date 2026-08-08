import { Module } from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { LoginRateLimiter } from './application/login-rate-limiter';
import { PasswordResetRateLimiter } from './application/password-reset-rate-limiter';
import { PasswordService } from './application/password.service';
import { SessionService } from './application/session.service';
import { AuthController } from './presentation/controllers/auth.controller';
import { MfaService } from './application/mfa.service';
import { CredentialTokenService } from './application/credential-token.service';
import { UserCredentialService } from './application/user-credential.service';
import { AvatarService } from './application/avatar.service';
import { GoogleIdentityService } from './application/google-identity.service';
import { ProfilePreferencesController } from './presentation/controllers/profile-preferences.controller';
import { CoursePreviewAccessService } from './application/course-preview-access.service';
import { COURSE_PREVIEW_ACCESS } from '../enrollment/application/course-preview.port';

@Module({
  controllers: [AuthController, ProfilePreferencesController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    LoginRateLimiter,
    PasswordResetRateLimiter,
    MfaService,
    CredentialTokenService,
    UserCredentialService,
    AvatarService,
    GoogleIdentityService,
    { provide: COURSE_PREVIEW_ACCESS, useClass: CoursePreviewAccessService },
  ],
  // Facade credential diekspor agar Users tidak mengakses persistence identity.
  exports: [SessionService, UserCredentialService, GoogleIdentityService, COURSE_PREVIEW_ACCESS],
})
export class IdentityModule {}
