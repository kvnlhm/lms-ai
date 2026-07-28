import type { ActiveSession } from '../../modules/identity/domain/session';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      session?: ActiveSession & { deviceRecordId: string };
    }
  }
}

export {};
