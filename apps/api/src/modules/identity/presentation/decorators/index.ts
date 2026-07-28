import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PermissionCode } from '@lms/contracts';
import type { Request } from 'express';
import type { ActiveSession, AuthenticatedUser } from '../../domain/session';

export const IS_PUBLIC_KEY = 'lms:isPublic';
export const PERMISSIONS_KEY = 'lms:permissions';

/**
 * Menandai endpoint yang boleh diakses tanpa session.
 * Guard bersifat global, jadi endpoint publik harus dinyatakan eksplisit —
 * lupa memberi anotasi berakibat endpoint tertutup, bukan terbuka.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Semua permission yang disebut wajib dimiliki, bukan salah satu. */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.session!;
  },
);

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ActiveSession => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.session!;
  },
);
