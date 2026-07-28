import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionCode } from '@lms/contracts';
import type { Request } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { PERMISSIONS_KEY } from '../decorators';

/**
 * Memeriksa permission yang dideklarasikan handler.
 *
 * Permission hanya lapisan pertama. Kepemilikan resource, status enrollment,
 * dan status akun tetap diperiksa di application service masing-masing modul,
 * sesuai ACCESS_CONTROL_MATRIX.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const session = request.session;
    if (!session) throw AppError.authenticationRequired();

    const granted = new Set(session.permissions);
    const hasAll = required.every((permission) => granted.has(permission));
    if (!hasAll) throw AppError.permissionDenied();

    return true;
  }
}
