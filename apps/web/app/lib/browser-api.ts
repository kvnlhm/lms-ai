'use client';

import { ApiError, createApiClient, unwrap } from '@lms/api-client';

/** Basis URL yang dipakai browser; harus dapat dijangkau dari perangkat pengguna. */
export function browserApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

const CSRF_COOKIE = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? 'lms_csrf';

/**
 * Membaca token CSRF dari cookie yang disetel API saat login.
 *
 * Cookie ini sengaja dapat dibaca JavaScript: nilainya bukan kredensial dan
 * tidak berguna tanpa cookie session yang HttpOnly. Situs lain tidak dapat
 * membacanya, sehingga tidak dapat menyusun header yang benar.
 */
export function readCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Client browser dengan header CSRF terpasang untuk mutation. */
export function browserClient() {
  const token = readCsrfToken();
  return createApiClient(browserApiUrl(), token ? { 'X-CSRF-Token': token } : undefined);
}

export { ApiError, unwrap };
