import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AppConfig } from '../../../../config/configuration';
import { AppError } from '../../../../shared/errors/app-error';
import { SessionService } from '../../application/session.service';
import {
  ALLOW_IMPERSONATION_MUTATION_KEY,
  ALLOW_PENDING_MFA_KEY,
  IS_PUBLIC_KEY,
} from '../decorators';

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

    // Endpoint publik tidak boleh berubah menjadi endpoint terautentikasi hanya
    // karena browser kebetulan mengirim cookie lama. Selain membuat katalog dan
    // registrasi gagal bagi pengguna dengan session pending MFA, perilaku lama
    // juga memblokir webhook provider karena request tanpa session diproses
    // berbeda dari request yang membawa cookie invalid/pending.
    //
    // Authorization, CSRF, dan pemasangan request.session hanya berlaku untuk
    // endpoint protected. Endpoint publik tetap wajib menerapkan kontrolnya
    // sendiri (misalnya rate limit checkout dan verifikasi signature webhook).
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.[this.app.session.cookieName] as string | undefined;

    if (!sessionId) {
      throw AppError.authenticationRequired();
    }

    const session = await this.sessions.touch(sessionId);
    if (!session) {
      throw AppError.authenticationRequired();
    }

    // Session yang belum melewati faktor kedua hanya boleh menyentuh alur MFA.
    if (session.pendingMfa) {
      const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_MFA_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowPending) {
        throw new AppError(
          'MFA_REQUIRED',
          403,
          'Selesaikan verifikasi dua faktor terlebih dahulu.',
        );
      }
    }

    if (MUTATING_METHODS.has(request.method)) {
      if (session.impersonatedByUserId) {
        const allowed = this.reflector.getAllAndOverride<boolean>(
          ALLOW_IMPERSONATION_MUTATION_KEY,
          [context.getHandler(), context.getClass()],
        );
        if (!allowed) throw AppError.permissionDenied();
      }
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
      pendingMfa: session.pendingMfa === true,
      mfaSetupRequired: session.mfaSetupRequired === true,
      impersonatedByUserId: session.impersonatedByUserId,
      originalSessionId: session.originalSessionId,
    };

    return true;
  }
}
