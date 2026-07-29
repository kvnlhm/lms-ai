import 'server-only';
import { notFound, redirect } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { ApiError, serverClient, unwrap } from './api';

export type CurrentUser = Schemas['CurrentUserResponseDto'];

/** Mengembalikan pengguna saat ini, atau null bila session tidak ada/kedaluwarsa. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const client = await serverClient();
    return unwrap(await client.GET('/api/v1/auth/me', {}));
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) return null;
    throw error;
  }
}

/**
 * Versi yang mengalihkan ke halaman masuk bila belum terautentikasi.
 * `next` disertakan supaya pengguna kembali ke halaman yang dituju setelah masuk.
 */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login';
    redirect(target);
  }
  return user;
}

/** Benar bila pengguna memegang permission tertentu. */
export function can(user: CurrentUser, permission: string): boolean {
  return user.permissions.includes(permission as CurrentUser['permissions'][number]);
}

/**
 * Menuntut permission untuk halaman Master.
 *
 * Pemeriksaan ini hanya untuk pengalaman pengguna — API tetap menolak sendiri
 * bila permission tidak ada. Menyembunyikan tautan bukan kontrol keamanan.
 */
export async function requirePermission(
  permission: string,
  returnTo: string,
): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!can(user, permission)) notFound();
  return user;
}

export function initials(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}
