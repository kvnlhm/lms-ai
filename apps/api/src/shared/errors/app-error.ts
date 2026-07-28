import type { ErrorCode } from '@lms/contracts';

/**
 * Error domain/aplikasi dengan kode yang dapat dibaca mesin.
 *
 * Status HTTP ditentukan di sini supaya controller tidak perlu memetakan
 * ulang, dan supaya kode error yang sama selalu memakai status yang sama
 * di seluruh API (docs/api/API_CONTRACT.md bagian 3 dan 4).
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static authenticationRequired(): AppError {
    return new AppError('AUTHENTICATION_REQUIRED', 401, 'Silakan masuk terlebih dahulu.');
  }

  static invalidCredentials(): AppError {
    return new AppError('INVALID_CREDENTIALS', 401, 'Email atau kata sandi salah.');
  }

  static accountInactive(): AppError {
    return new AppError('ACCOUNT_INACTIVE', 403, 'Akun belum aktif.');
  }

  static accountSuspended(): AppError {
    return new AppError('ACCOUNT_SUSPENDED', 403, 'Akun ditangguhkan.');
  }

  static permissionDenied(): AppError {
    return new AppError('PERMISSION_DENIED', 403, 'Kamu tidak memiliki izin untuk tindakan ini.');
  }

  /**
   * Dipakai juga ketika keberadaan resource tidak boleh diketahui
   * (ACCESS_CONTROL_MATRIX bagian Denial Behaviour).
   */
  static notFound(): AppError {
    return new AppError('RESOURCE_NOT_FOUND', 404, 'Data tidak ditemukan.');
  }

  static csrfInvalid(): AppError {
    return new AppError('CSRF_TOKEN_INVALID', 403, 'Token CSRF tidak valid.');
  }

  static enrollmentInactive(): AppError {
    return new AppError('ENROLLMENT_INACTIVE', 403, 'Akses kursus kamu tidak aktif.');
  }

  static courseNotPublished(): AppError {
    return new AppError('COURSE_NOT_PUBLISHED', 404, 'Kursus belum terbit.');
  }

  static lessonLocked(message = 'Pelajaran ini belum bisa dibuka.'): AppError {
    return new AppError('LESSON_LOCKED', 403, message);
  }

  static idempotencyConflict(): AppError {
    return new AppError(
      'IDEMPOTENCY_CONFLICT',
      409,
      'Idempotency-Key sudah dipakai untuk permintaan dengan isi berbeda.',
    );
  }

  static rateLimited(): AppError {
    return new AppError('RATE_LIMITED', 429, 'Terlalu banyak percobaan. Coba lagi nanti.');
  }

  static validation(fields: Record<string, string[]>): AppError {
    return new AppError('VALIDATION_ERROR', 422, 'Data yang diberikan tidak valid.', fields);
  }
}
