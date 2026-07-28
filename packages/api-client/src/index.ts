import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

export function createApiClient(baseUrl: string) {
  return createClient<paths>({
    baseUrl: `${baseUrl.replace(/\/$/, '')}/api/v1`,
    credentials: 'include',
  });
}

export async function checkApiHealth(baseUrl: string): Promise<{ ok: boolean; ready: boolean }> {
  const client = createApiClient(baseUrl);
  try {
    const live = await client.GET('/health/live', {});
    if (live.error || !live.response.ok) return { ok: false, ready: false };

    const ready = await client.GET('/health/ready', {});
    return { ok: true, ready: !ready.error && ready.response.ok };
  } catch {
    return { ok: false, ready: false };
  }
}

export type { paths } from './generated/schema';
