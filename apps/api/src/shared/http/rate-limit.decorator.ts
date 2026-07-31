import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'lms:rateLimit';
export const SKIP_RATE_LIMIT_KEY = 'lms:skipRateLimit';

export interface RateLimitOptions {
  /** Permintaan maksimum dalam satu jendela. */
  limit: number;
  windowSeconds: number;
}

/**
 * Anggaran yang lebih ketat daripada bawaan untuk satu endpoint.
 *
 * Dipakai pada endpoint yang satu permintaannya jauh lebih mahal daripada
 * rata-rata — pencarian global, misalnya, menjalankan lima kueri sekaligus.
 */
export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } satisfies RateLimitOptions);

/**
 * Membebaskan endpoint dari pembatas laju.
 *
 * Hanya untuk endpoint yang memang dipanggil mesin secara berkala, seperti
 * health check yang dipolling Coolify setiap beberapa detik.
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
