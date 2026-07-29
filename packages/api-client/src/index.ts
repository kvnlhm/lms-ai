import createClient from 'openapi-fetch';
import type { components, paths } from './generated/schema';

export type Schemas = components['schemas'];
export type { paths } from './generated/schema';

/** Kode error yang dikirim API; sama dengan daftar di docs/api/API_CONTRACT.md. */
export type ApiErrorCode = Schemas['ApiErrorBodyDto']['code'];

/**
 * Kegagalan yang berasal dari API dengan kode yang dapat dibaca mesin.
 *
 * UI membedakan penanganan berdasarkan `code`, bukan dengan mencocokkan
 * teks pesan, sehingga perubahan kalimat tidak merusak alur.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | 'NETWORK_ERROR',
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string[]>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthenticated(): boolean {
    return this.code === 'AUTHENTICATION_REQUIRED' || this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export function createApiClient(baseUrl: string, headers?: Record<string, string>) {
  return createClient<paths>({
    baseUrl: baseUrl.replace(/\/$/, ''),
    credentials: 'include',
    headers,
  });
}

/**
 * Client untuk render di server.
 *
 * Cookie session tidak ikut secara otomatis pada fetch dari server, jadi
 * header Cookie diteruskan eksplisit dari request yang masuk.
 */
export function createServerApiClient(baseUrl: string, cookieHeader: string) {
  return createApiClient(baseUrl, cookieHeader ? { cookie: cookieHeader } : undefined);
}

interface EnvelopeResult<T> {
  data?: { data: T; meta: unknown } | undefined;
  error?: unknown;
  response: Response;
}

/**
 * Membuka amplop `{ data, meta }` dan mengubah badan error menjadi `ApiError`.
 * Pemanggil bekerja dengan payload, bukan dengan bentuk transport.
 */
export function unwrap<T>(result: EnvelopeResult<T>): T {
  if (result.error !== undefined) {
    throw toApiError(result.error, result.response.status);
  }
  if (!result.response.ok) {
    throw new ApiError('INTERNAL_ERROR', result.response.status, 'Terjadi kesalahan pada server.');
  }
  if (result.data === undefined) {
    throw new ApiError('INTERNAL_ERROR', result.response.status, 'Respons kosong dari server.');
  }
  return result.data.data;
}

/** Varian untuk daftar berhalaman: mengembalikan item beserta metanya. */
export function unwrapList<T>(
  result: EnvelopeResult<T[]> & { data?: { data: T[]; meta: Schemas['PaginatedMetaDto'] } },
): { items: T[]; meta: Schemas['PaginatedMetaDto'] } {
  if (result.error !== undefined) {
    throw toApiError(result.error, result.response.status);
  }
  if (!result.data) {
    throw new ApiError('INTERNAL_ERROR', result.response.status, 'Respons kosong dari server.');
  }
  return { items: result.data.data, meta: result.data.meta };
}

function toApiError(payload: unknown, status: number): ApiError {
  const body = (payload as { error?: Schemas['ApiErrorBodyDto'] } | undefined)?.error;
  if (!body) {
    return new ApiError('INTERNAL_ERROR', status, 'Terjadi kesalahan pada server.');
  }
  return new ApiError(body.code, status, body.message, body.fields, body.requestId);
}

export async function checkApiHealth(baseUrl: string): Promise<{ ok: boolean; ready: boolean }> {
  const client = createApiClient(baseUrl);
  try {
    const live = await client.GET('/api/v1/health/live', {});
    if (live.error || !live.response.ok) return { ok: false, ready: false };

    const ready = await client.GET('/api/v1/health/ready', {});
    return { ok: true, ready: !ready.error && ready.response.ok };
  } catch {
    return { ok: false, ready: false };
  }
}
