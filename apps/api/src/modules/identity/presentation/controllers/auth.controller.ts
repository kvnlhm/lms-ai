import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelope,
  ApiEnvelopeArray,
  ApiErrors,
} from '../../../../shared/http/api-envelope';
import {
  AvatarUploadResponseDto,
  CurrentUserResponseDto,
  DeviceSessionDto,
  ForgotPasswordResponseDto,
  InvitationAcceptedDto,
  LoginResponseDto,
  LogoutAllResponseDto,
  MfaSetupDto,
  PasswordChangedResponseDto,
  PasswordResetDto,
} from '../dto/auth.response';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../../../../config/configuration';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../../../shared/audit/audit.service';
import { AppError } from '../../../../shared/errors/app-error';
import { AuthService } from '../../application/auth.service';
import { AvatarService } from '../../application/avatar.service';
import { MfaService } from '../../application/mfa.service';
import { SessionService } from '../../application/session.service';
import { UserCredentialService } from '../../application/user-credential.service';
import type { ActiveSession, AuthenticatedUser } from '../../domain/session';
import { AllowPendingMfa, CurrentSession, CurrentUser, Public } from '../decorators';
import {
  AcceptInvitationDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  MfaCodeDto,
  ResetPasswordDto,
  UpdateCurrentUserDto,
} from '../dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly app: AppConfig;

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly credentials: UserCredentialService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly avatars: AvatarService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  @Public()
  @Post('accept-invitation')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menetapkan password dari undangan sekali pakai' })
  @ApiEnvelope(InvitationAcceptedDto)
  @ApiErrors(422)
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    this.assertPasswordConfirmation(dto.password, dto.passwordConfirmation);
    await this.credentials.acceptInvitation(dto.token, dto.password);
    return { accepted: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Meminta tautan pemulihan password dikirim ke email' })
  @ApiEnvelope(ForgotPasswordResponseDto, 'Selalu sama, terlepas dari terdaftar atau tidak.')
  @ApiErrors(422, 429)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    await this.auth.requestPasswordReset({ email: dto.email, ipAddress: clientIp(request) });
    return { requested: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengganti password menggunakan token sekali pakai' })
  @ApiEnvelope(PasswordResetDto)
  @ApiErrors(422)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    this.assertPasswordConfirmation(dto.password, dto.passwordConfirmation);
    await this.credentials.resetPassword(dto.token, dto.password);
    return { reset: true };
  }

  @Post('mfa/setup')
  @AllowPendingMfa()
  @ApiOperation({ summary: 'Menyiapkan TOTP pertama untuk Master' })
  @ApiEnvelope(MfaSetupDto)
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

  @Public()
  @Post('google')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Masuk dengan akun Google',
    description:
      'Menerima ID token dari tombol Google di browser. Tidak pernah membuat akun: ' +
      'akun hanya lahir dari webhook pembayaran, sehingga pendaftar yang belum ' +
      'membayar dibalas 401 dan bukan dibuatkan akun.',
  })
  @ApiEnvelope(LoginResponseDto, 'Berhasil masuk; cookie session dan CSRF disetel.')
  @ApiErrors(401, 403, 422, 429)
  async loginWithGoogle(@Body() dto: GoogleLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    // Rotasi session yang sama dengan masuk memakai kata sandi (ADR-010).
    const existing = request.cookies?.[this.app.session.cookieName] as string | undefined;
    if (existing) await this.sessions.destroy(existing);

    const result = await this.auth.loginWithGoogle({
      idToken: dto.idToken,
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

  @Patch('me')
  @ApiOperation({ summary: 'Memperbarui profil pengguna saat ini' })
  @ApiEnvelope(CurrentUserResponseDto)
  @ApiErrors(401, 422)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCurrentUserDto,
    @Req() request: Request,
  ) {
    const updated = await this.auth.updateCurrentUser(user, dto);
    await this.audit.record({
      actorUserId: user.id,
      action: 'user.profile_updated',
      targetType: 'user',
      targetId: user.id,
      after: { changedFields: Object.keys(dto) },
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
    return updated;
  }

  @Patch('me/password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengganti password sendiri dan mencabut seluruh session' })
  @ApiEnvelope(PasswordChangedResponseDto)
  @ApiErrors(401, 422)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    this.assertPasswordConfirmation(dto.newPassword, dto.newPasswordConfirmation, 'newPasswordConfirmation');
    await this.credentials.changePassword(user.id, dto.currentPassword, dto.newPassword);
    await this.audit.record({
      actorUserId: user.id,
      action: 'user.password_changed',
      targetType: 'user',
      targetId: user.id,
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
    return { changed: true };
  }

  @Put('me/avatar')
  @HttpCode(200)
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  @ApiOperation({ summary: 'Mengunggah atau mengganti foto profil sendiri' })
  @ApiEnvelope(AvatarUploadResponseDto)
  @ApiErrors(401, 422)
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const rawLength = request.header('content-length');
    const result = await this.avatars.upload(
      user.id,
      request,
      request.header('content-type'),
      rawLength ? Number.parseInt(rawLength, 10) : undefined,
    );
    await this.audit.record({
      actorUserId: user.id,
      action: 'user.avatar_updated',
      targetType: 'user',
      targetId: user.id,
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
    return result;
  }

  @Delete('me/avatar')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Foto profil dihapus.' })
  @ApiErrors(401)
  async removeAvatar(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    await this.avatars.remove(user.id);
    await this.audit.record({
      actorUserId: user.id,
      action: 'user.avatar_removed',
      targetType: 'user',
      targetId: user.id,
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
  }

  @Public()
  @Get('avatars/:filename')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @ApiOperation({ summary: 'Menyajikan foto profil publik berdasarkan nama file acak' })
  @ApiErrors(404)
  async avatar(@Param('filename') filename: string, @Res() response: Response) {
    const file = await this.avatars.open(filename);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.size));
    file.stream.pipe(response);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Perangkat aktif milik pengguna saat ini' })
  @ApiEnvelopeArray(DeviceSessionDto)
  @ApiErrors(401)
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSession() session: ActiveSession & { deviceRecordId: string },
  ) {
    return this.auth.listDevices(user.id, session.deviceRecordId);
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

  private assertPasswordConfirmation(
    password: string,
    confirmation: string,
    field = 'passwordConfirmation',
  ): void {
    if (password !== confirmation) {
      throw AppError.validation({
        [field]: ['Konfirmasi password tidak sama.'],
      });
    }
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
