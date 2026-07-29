import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelope,
  ApiEnvelopeArray,
  ApiErrors,
} from '../../../../shared/http/api-envelope';
import {
  CurrentUserResponseDto,
  DeviceSessionDto,
  LoginResponseDto,
  LogoutAllResponseDto,
} from '../dto/auth.response';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../../../../config/configuration';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../../shared/errors/app-error';
import { AuthService } from '../../application/auth.service';
import { MfaService } from '../../application/mfa.service';
import { SessionService } from '../../application/session.service';
import type { ActiveSession, AuthenticatedUser } from '../../domain/session';
import { AllowPendingMfa, CurrentSession, CurrentUser, Public } from '../decorators';
import { LoginDto, MfaCodeDto } from '../dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly app: AppConfig;

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly prisma: PrismaService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  @Post('mfa/setup')
  @AllowPendingMfa()
  @ApiOperation({ summary: 'Menyiapkan TOTP pertama untuk Master' })
  @ApiErrors(401, 403)
  async setupMfa(@CurrentSession() session: ActiveSession) {
    if (session.roleCode !== 'MASTER' || !session.mfaSetupRequired) {
      throw AppError.permissionDenied();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!user) throw AppError.authenticationRequired();
    return this.mfa.beginSetup(session.id, user.email);
  }

  @Post('mfa/setup/confirm')
  @AllowPendingMfa()
  @ApiOperation({ summary: 'Mengonfirmasi TOTP dan merotasi session Master' })
  @ApiErrors(401, 403, 404, 422)
  async confirmMfaSetup(
    @Body() dto: MfaCodeDto,
    @CurrentSession() session: ActiveSession & { deviceRecordId: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    if (session.roleCode !== 'MASTER' || !session.mfaSetupRequired) {
      throw AppError.permissionDenied();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!user) throw AppError.authenticationRequired();
    await this.mfa.confirm(session.id, user.email, dto.code);
    await this.rotateMfaSession(session, response);
    return { verified: true };
  }

  @Post('mfa/verify')
  @AllowPendingMfa()
  @ApiOperation({ summary: 'Memverifikasi TOTP saat login dan merotasi session' })
  @ApiErrors(401, 403, 422)
  async verifyMfa(
    @Body() dto: MfaCodeDto,
    @CurrentSession() session: ActiveSession & { deviceRecordId: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    if (session.roleCode !== 'MASTER' || !session.pendingMfa || session.mfaSetupRequired) {
      throw AppError.permissionDenied();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!user || !(await this.mfa.verifyForLogin(session.id, user.email, dto.code))) {
      throw AppError.validation({ code: ['Kode autentikator tidak valid.'] });
    }
    await this.rotateMfaSession(session, response);
    return { verified: true };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Masuk dengan email dan kata sandi' })
  @ApiEnvelope(LoginResponseDto, 'Berhasil masuk; cookie session dan CSRF disetel.')
  @ApiErrors(401, 403, 422, 429)
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    // Session lama dibuang sebelum yang baru dibuat (rotasi, ADR-010).
    const existing = request.cookies?.[this.app.session.cookieName] as string | undefined;
    if (existing) await this.sessions.destroy(existing);

    const result = await this.auth.login({
      email: dto.email,
      password: dto.password,
      deviceName: dto.deviceName,
      ipAddress: clientIp(request),
      userAgent: request.header('user-agent') ?? undefined,
    });

    this.setSessionCookies(response, result.sessionId, result.csrfToken);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mencabut session saat ini' })
  @ApiNoContentResponse({ description: 'Session dicabut.' })
  @ApiErrors(401, 403)
  async logout(@CurrentSession() session: ActiveSession & { deviceRecordId: string }, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(session.sessionId, session.deviceRecordId);
    this.clearSessionCookies(response);
  }

  @Post('logout-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mencabut seluruh session milik pengguna saat ini' })
  @ApiEnvelope(LogoutAllResponseDto)
  @ApiErrors(401, 403)
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) response: Response) {
    const revoked = await this.auth.logoutAll(user.id);
    this.clearSessionCookies(response);
    return { revokedSessions: revoked };
  }

  @Get('me')
  @ApiOperation({ summary: 'Pengguna saat ini beserta permission efektifnya' })
  @ApiEnvelope(CurrentUserResponseDto)
  @ApiErrors(401)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.currentUser(user);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Perangkat aktif milik pengguna saat ini' })
  @ApiEnvelopeArray(DeviceSessionDto)
  @ApiErrors(401)
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listDevices(user.id);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mencabut satu perangkat milik sendiri' })
  @ApiNoContentResponse({ description: 'Perangkat dicabut.' })
  @ApiErrors(401, 403, 404)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    // Difilter berdasarkan userId: mengetahui ID perangkat orang lain tidak
    // memberi hak mencabutnya, dan responsnya 404 agar keberadaannya tidak
    // dapat disimpulkan.
    const updated = await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) throw AppError.notFound();
  }

  private baseCookie(): CookieOptions {
    return {
      domain: this.app.session.cookieDomain,
      path: '/',
      secure: this.app.session.cookieSecure,
      sameSite: this.app.session.cookieSameSite,
    };
  }

  private setSessionCookies(response: Response, sessionId: string, csrfToken: string): void {
    const maxAge = this.app.session.absoluteTtlSeconds * 1000;

    // Cookie session tidak dapat dibaca JavaScript.
    response.cookie(this.app.session.cookieName, sessionId, {
      ...this.baseCookie(),
      httpOnly: true,
      maxAge,
    });

    // Cookie CSRF sengaja dapat dibaca: klien menyalinnya ke header
    // X-CSRF-Token. Nilainya bukan kredensial dan tidak berguna tanpa
    // cookie session.
    response.cookie(this.app.session.csrfCookieName, csrfToken, {
      ...this.baseCookie(),
      httpOnly: false,
      maxAge,
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(this.app.session.cookieName, this.baseCookie());
    response.clearCookie(this.app.session.csrfCookieName, this.baseCookie());
  }

  private async rotateMfaSession(
    session: ActiveSession & { deviceRecordId: string },
    response: Response,
  ): Promise<void> {
    const rotated = await this.sessions.rotateAfterMfa(session.sessionId, {
      userId: session.id,
      roleCode: session.roleCode,
      permissions: session.permissions,
      deviceRecordId: session.deviceRecordId,
    });
    this.setSessionCookies(response, rotated.sessionId, rotated.csrfToken);
  }
}

function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? '0.0.0.0';
}
