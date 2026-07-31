import type { PermissionCode, RoleCode } from '@lms/contracts';

/** Isi session yang disimpan server-side di Redis. Tidak pernah dikirim utuh ke klien. */
export interface SessionData {
  userId: string;
  roleCode: RoleCode;
  permissions: PermissionCode[];
  csrfToken: string;
  /** Batas waktu absolut; tidak diperpanjang oleh aktivitas. */
  absoluteExpiresAt: number;
  deviceRecordId: string;
  createdAt: number;
  /**
   * Session yang belum melewati faktor kedua.
   *
   * Cookie sudah terpasang supaya alur MFA punya identitas, tetapi guard
   * menolak seluruh endpoint kecuali yang ditandai `@AllowPendingMfa()`.
   * Dengan begitu kata sandi yang benar saja tidak memberi akses apa pun.
   */
  pendingMfa?: boolean;
  /** Master yang belum menyiapkan MFA; hanya boleh mengakses endpoint setup. */
  mfaSetupRequired?: boolean;
  /** Master yang memulai sesi lihat-sebagai. Tidak memberi permission Master. */
  impersonatedByUserId?: string;
  /** Session Master yang dipulihkan ketika sesi lihat-sebagai diakhiri. */
  originalSessionId?: string;
}

/** Bentuk pengguna yang dilihat guard dan controller. */
export interface AuthenticatedUser {
  id: string;
  roleCode: RoleCode;
  permissions: PermissionCode[];
  impersonatedByUserId?: string;
}

export interface ActiveSession extends AuthenticatedUser {
  sessionId: string;
  csrfToken: string;
  deviceRecordId: string;
  pendingMfa?: boolean;
  mfaSetupRequired?: boolean;
  impersonatedByUserId?: string;
  originalSessionId?: string;
}
