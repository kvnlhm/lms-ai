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
}

/** Bentuk pengguna yang dilihat guard dan controller. */
export interface AuthenticatedUser {
  id: string;
  roleCode: RoleCode;
  permissions: PermissionCode[];
}

export interface ActiveSession extends AuthenticatedUser {
  sessionId: string;
  csrfToken: string;
}
