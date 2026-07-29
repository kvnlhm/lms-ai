import 'server-only';
import { cookies } from 'next/headers';
import { ApiError, createServerApiClient, unwrap, unwrapList } from '@lms/api-client';

/**
 * Basis URL API untuk pemanggilan dari server.
 *
 * `API_URL` dipakai saat render di server (nama service di jaringan Docker),
 * `NEXT_PUBLIC_API_URL` dipakai browser. Keduanya dibedakan karena alamat yang
 * benar berbeda tergantung siapa yang memanggil.
 */
export function serverApiUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

/**
 * Client bercookie untuk Server Component.
 *
 * Cookie session tidak ikut otomatis pada fetch dari server, jadi header
 * Cookie dari request yang masuk diteruskan apa adanya.
 */
export async function serverClient() {
  const store = await cookies();
  const header = store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  return createServerApiClient(serverApiUrl(), header);
}

export { ApiError, unwrap, unwrapList };
