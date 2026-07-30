/**
 * Kontrak yang dipakai bersama oleh API dan web.
 *
 * Paket ini sengaja hanya berisi konstanta dan tipe amplop respons. Entity
 * backend dan tipe Prisma tidak boleh diekspor dari sini (ADR-009); bentuk
 * payload endpoint datang dari client yang digenerate dari OpenAPI.
 */

export const ERROR_CODES = [
  'AUTHENTICATION_REQUIRED',
  'INVALID_CREDENTIALS',
  'ACCOUNT_INACTIVE',
  'ACCOUNT_SUSPENDED',
  'MFA_REQUIRED',
  'TOKEN_EXPIRED',
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_ERROR',
  'EMAIL_ALREADY_USED',
  'ENROLLMENT_ALREADY_EXISTS',
  'ENROLLMENT_INACTIVE',
  'COURSE_NOT_PUBLISHED',
  'LESSON_LOCKED',
  'LESSON_ALREADY_COMPLETED',
  'IDEMPOTENCY_CONFLICT',
  'DISCUSSION_LOCKED',
  'FILE_NOT_AVAILABLE',
  'REPORT_NOT_READY',
  'RATE_LIMITED',
  'CSRF_TOKEN_INVALID',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ROLES = {
  MASTER: 'MASTER',
  STUDENT: 'STUDENT',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

/** Kode permission mengikuti docs/security/ACCESS_CONTROL_MATRIX.md. */
export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  USERS_SECURITY_MANAGE: 'users.security.manage',
  COURSES_MANAGE: 'courses.manage',
  ENROLLMENTS_MANAGE: 'enrollments.manage',
  DISCUSSIONS_MODERATE: 'discussions.moderate',
  ANALYTICS_READ: 'analytics.read',
  REPORTS_EXPORT: 'reports.export',
  AUDIT_READ: 'audit.read',
  ROLES_MANAGE: 'roles.manage',
  ANNOUNCEMENTS_MANAGE: 'announcements.manage',
  COMMERCE_MANAGE: 'commerce.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface ResponseMeta {
  requestId: string;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface SuccessResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string[]>;
    requestId: string;
  };
}
