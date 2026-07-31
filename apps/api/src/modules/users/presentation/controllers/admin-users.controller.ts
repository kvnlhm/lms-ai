import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiEnvelopeList, ApiErrors } from '../../../../shared/http/api-envelope';
import { Paginated } from '../../../../shared/http/response.interceptor';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../../../../config/configuration';
import { AuditService } from '../../../../shared/audit/audit.service';
import { AppError } from '../../../../shared/errors/app-error';
import type { ActiveSession, AuthenticatedUser } from '../../../identity/domain/session';
import {
  AllowImpersonationMutation,
  CurrentSession,
  CurrentUser,
  RequirePermissions,
} from '../../../identity/presentation/decorators';
import { UserAdminService } from '../../application/user-admin.service';
import {
  AdminUserListItemDto,
  AdminUserMutationResponseDto,
  CreateAdminUserDto,
  CreateAdminUserResponseDto,
  CredentialLinkResponseDto,
  ListAdminUsersDto,
  SuspendAdminUserDto,
  UpdateAdminUserDto,
} from '../dto/admin-user.dto';

@ApiTags('admin-users')
@Controller('admin/users')
export class AdminUsersController {
  private readonly app: AppConfig;

  constructor(
    private readonly users: UserAdminService,
    private readonly audit: AuditService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'Mencari dan memfilter pengguna untuk pengelolaan Master' })
  @ApiEnvelopeList(AdminUserListItemDto)
  @ApiErrors(401, 403, 422)
  async list(@Query() query: ListAdminUsersDto) {
    const { items, total } = await this.users.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      role: query.role,
    });
    return new Paginated(items, query.page, query.pageSize, total);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Membuat akun dan menerbitkan undangan sekali pakai' })
  @ApiEnvelope(CreateAdminUserResponseDto)
  @ApiErrors(401, 403, 409, 422)
  async create(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (dto.role === 'MASTER' && !actor.permissions.includes(PERMISSIONS.ROLES_MANAGE)) {
      throw AppError.permissionDenied();
    }
    const created = await this.users.create(dto);
    await this.log(request, actor, 'user.created', created.id, {
      fullName: created.fullName,
      email: created.email,
      role: created.role,
      status: created.status,
    });
    return created;
  }

  @Patch(':userId')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Mengubah profil administratif pengguna' })
  @ApiEnvelope(AdminUserMutationResponseDto)
  @ApiErrors(401, 403, 404, 422)
  async update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const updated = await this.users.update(userId, dto);
    await this.log(request, actor, 'user.updated', userId, dto);
    return updated;
  }

  @Post(':userId/suspend')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Menangguhkan akun dan mencabut seluruh session' })
  @ApiEnvelope(AdminUserMutationResponseDto)
  @ApiErrors(401, 403, 404, 422)
  async suspend(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: SuspendAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (userId === actor.id) {
      throw AppError.validation({ userId: ['Master tidak dapat menangguhkan akunnya sendiri.'] });
    }
    const updated = await this.users.setStatus(userId, 'SUSPENDED');
    await this.log(request, actor, 'user.suspended', userId, { reason: dto.reason });
    return updated;
  }

  @Post(':userId/activate')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Mengaktifkan kembali akun' })
  @ApiEnvelope(AdminUserMutationResponseDto)
  @ApiErrors(401, 403, 404)
  async activate(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const updated = await this.users.setStatus(userId, 'ACTIVE');
    await this.log(request, actor, 'user.activated', userId);
    return updated;
  }

  @Post(':userId/reset-mfa')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.USERS_SECURITY_MANAGE)
  @ApiOperation({ summary: 'Menghapus MFA dan mencabut seluruh session pengguna' })
  @ApiErrors(401, 403, 404)
  async resetMfa(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (userId === actor.id) {
      throw AppError.validation({ userId: ['Gunakan alur pemulihan akun untuk MFA sendiri.'] });
    }
    await this.users.resetMfa(userId);
    await this.log(request, actor, 'user.mfa_reset', userId);
  }

  @Post(':userId/password-reset-link')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.USERS_SECURITY_MANAGE)
  @ApiOperation({ summary: 'Menerbitkan token reset password sekali pakai' })
  @ApiEnvelope(CredentialLinkResponseDto)
  @ApiErrors(401, 403, 404)
  async passwordResetLink(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const token = await this.users.issuePasswordReset(userId);
    await this.log(request, actor, 'user.password_reset_issued', userId, {
      expiresAt: token.expiresAt,
    });
    return token;
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Menghapus dan meredaksi akun Pelajar' })
  @ApiErrors(401, 403, 404, 422)
  async remove(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (userId === actor.id) {
      throw AppError.validation({ userId: ['Master tidak dapat menghapus akunnya sendiri.'] });
    }
    await this.users.deleteStudent(userId);
    await this.log(request, actor, 'user.deleted', userId, { personalDataRedacted: true });
  }

  @Post(':userId/impersonate')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.USERS_SECURITY_MANAGE)
  @ApiOperation({ summary: 'Memulai pratinjau hanya-baca sebagai Pelajar' })
  @ApiErrors(401, 403, 404, 422)
  async impersonate(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentSession() actor: ActiveSession,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const preview = await this.users.startImpersonation(actor, userId, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
    await this.log(request, actor, 'user.impersonation_started', userId, { readOnly: true });
    this.setSessionCookies(response, preview.sessionId, preview.csrfToken);
    return { started: true };
  }

  @Post('impersonation/end')
  @HttpCode(200)
  @AllowImpersonationMutation()
  @ApiOperation({ summary: 'Mengakhiri pratinjau dan memulihkan sesi Master' })
  @ApiErrors(401, 403)
  async endImpersonation(
    @CurrentSession() session: ActiveSession,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const restored = await this.users.endImpersonation(session);
    await this.audit.record({
      actorUserId: session.impersonatedByUserId!,
      action: 'user.impersonation_ended',
      targetType: 'user',
      targetId: session.id,
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
    this.setSessionCookies(response, restored.sessionId, restored.csrfToken);
    return { ended: true };
  }

  private setSessionCookies(response: Response, sessionId: string, csrfToken: string): void {
    const options: CookieOptions = {
      domain: this.app.session.cookieDomain,
      path: '/',
      secure: this.app.session.cookieSecure,
      sameSite: this.app.session.cookieSameSite,
      maxAge: this.app.session.absoluteTtlSeconds * 1000,
    };
    response.cookie(this.app.session.cookieName, sessionId, { ...options, httpOnly: true });
    response.cookie(this.app.session.csrfCookieName, csrfToken, { ...options, httpOnly: false });
  }

  private async log(
    request: Request,
    actor: AuthenticatedUser,
    action: string,
    targetId: string,
    after?: unknown,
  ): Promise<void> {
    await this.audit.record({
      actorUserId: actor.id,
      action,
      targetType: 'user',
      targetId,
      after,
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
  }
}
