import type { ActiveSession } from '../../modules/identity/domain/session';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      /**
       * Badan permintaan apa adanya, hanya diisi untuk jalur yang tanda
       * tangannya dihitung atas byte mentah. Lihat `bootstrap.ts`.
       */
      rawBody?: Buffer;
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
