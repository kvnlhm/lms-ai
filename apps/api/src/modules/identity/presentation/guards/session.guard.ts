import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AppConfig } from '../../../../config/configuration';
import { AppError } from '../../../../shared/errors/app-error';
import { SessionService } from '../../application/session.service';
import { IS_PUBLIC_KEY } from '../decorators';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Guard global. Menolak lebih dulu, mengizinkan hanya bila session valid.
 *
 * Sekaligus menegakkan CSRF double-submit: untuk metode yang mengubah state,
 * header `X-CSRF-Token` harus cocok dengan token yang tersimpan di session.
 * Cookie CSRF dapat dibaca JavaScript, tetapi penyerang lintas situs tidak
 * dapat membacanya, sehingga tidak dapat menyusun header yang benar.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  private readonly app: AppConfig;

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.app = config.get('app', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.[this.app.session.cookieName] as string | undefined;

    if (!sessionId) {
      if (isPublic) return true;
      throw AppError.authenticationRequired();
    }

    const session = await this.sessions.touch(sessionId);
    if (!session) {
      if (isPublic) return true;
      throw AppError.authenticationRequired();
    }

    if (MUTATING_METHODS.has(request.method)) {
      const header = request.header('x-csrf-token');
      if (!SessionService.csrfMatches(session.csrfToken, header)) {
        throw AppError.csrfInvalid();
      }
    }

    request.session = {
      sessionId,
      id: session.userId,
      roleCode: session.roleCode,
      permissions: session.permissions,
      csrfToken: session.csrfToken,
      deviceRecordId: session.deviceRecordId,
    };

    return true;
  }
}
