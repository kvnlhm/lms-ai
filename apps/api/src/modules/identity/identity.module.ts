import { Module } from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { LoginRateLimiter } from './application/login-rate-limiter';
import { PasswordService } from './application/password.service';
import { SessionService } from './application/session.service';
import { AuthController } from './presentation/controllers/auth.controller';
import { MfaService } from './application/mfa.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService, LoginRateLimiter, MfaService],
  // Hanya SessionService yang diekspor: modul lain butuh guard, bukan akses
  // ke persistence identity.
  exports: [SessionService],
})
export class IdentityModule {}
