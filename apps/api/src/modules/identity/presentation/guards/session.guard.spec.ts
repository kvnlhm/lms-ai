import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { AppConfig } from '../../../../config/configuration';
import type { SessionService } from '../../application/session.service';
import { SessionGuard } from './session.guard';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  const app = {
    session: { cookieName: 'lms_session' },
  } as AppConfig;

  function createGuard(isPublic: boolean, touch = jest.fn()) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(isPublic),
    } as unknown as Reflector;
    const sessions = { touch } as unknown as SessionService;
    const config = {
      get: jest.fn().mockReturnValue(app),
    } as unknown as ConfigService<{ app: AppConfig }, true>;

    return { guard: new SessionGuard(reflector, sessions, config), touch };
  }

  it('allows a public endpoint without inspecting an existing pending-MFA session', async () => {
    const touch = jest.fn().mockResolvedValue({ pendingMfa: true });
    const { guard } = createGuard(true, touch);
    const request = {
      method: 'POST',
      cookies: { lms_session: 'old-session' },
      header: jest.fn(),
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(touch).not.toHaveBeenCalled();
    expect(request.header).not.toHaveBeenCalled();
  });

  it('still rejects a protected endpoint without a session', async () => {
    const { guard } = createGuard(false);
    const request = { method: 'GET', cookies: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      status: 401,
    });
  });
});
