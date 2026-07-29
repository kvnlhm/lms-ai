import type { ActiveSession } from '../../modules/identity/domain/session';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      session?: ActiveSession & {
        deviceRecordId: string;
        /** Benar bila session belum melewati faktor kedua. */
        pendingMfa: boolean;
        /** Benar bila Master wajib menyiapkan MFA sebelum dapat bekerja. */
        mfaSetupRequired: boolean;
      };
    }
  }
}

export {};
