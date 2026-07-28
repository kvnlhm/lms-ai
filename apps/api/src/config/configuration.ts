function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Environment variable ${name} wajib diisi.`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} harus berupa angka.`);
  }
  return parsed;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

export type SameSite = 'lax' | 'strict' | 'none';

export interface AppConfig {
  env: string;
  appName: string;
  port: number;
  webUrl: string;
  logLevel: string;
  database: { url: string };
  redis: {
    url: string;
    sessionPrefix: string;
    cachePrefix: string;
  };
  session: {
    cookieName: string;
    cookieDomain: string | undefined;
    cookieSecure: boolean;
    cookieSameSite: SameSite;
    csrfCookieName: string;
    idleTtlSeconds: number;
    absoluteTtlSeconds: number;
  };
  auth: {
    rateLimitWindowSeconds: number;
    rateLimitMax: number;
    passwordResetTtlMinutes: number;
  };
}

export function loadConfig(): AppConfig {
  const sameSite = (process.env.SESSION_COOKIE_SAME_SITE ?? 'lax') as SameSite;
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('SESSION_COOKIE_SAME_SITE harus lax, strict, atau none.');
  }

  return {
    env: process.env.APP_ENV ?? 'local',
    appName: process.env.APP_NAME ?? 'LMS Akademi Online',
    port: int('PORT', 3001),
    webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    database: { url: required('DATABASE_URL') },
    redis: {
      url: required('REDIS_URL'),
      sessionPrefix: process.env.REDIS_SESSION_PREFIX ?? 'lms:session:',
      cachePrefix: process.env.REDIS_CACHE_PREFIX ?? 'lms:cache:',
    },
    session: {
      cookieName: process.env.SESSION_COOKIE_NAME ?? 'lms_session',
      cookieDomain: process.env.SESSION_COOKIE_DOMAIN || undefined,
      cookieSecure: bool('SESSION_COOKIE_SECURE', true),
      cookieSameSite: sameSite,
      csrfCookieName: process.env.CSRF_COOKIE_NAME ?? 'lms_csrf',
      idleTtlSeconds: int('SESSION_IDLE_TTL_SECONDS', 1800),
      absoluteTtlSeconds: int('SESSION_ABSOLUTE_TTL_SECONDS', 43200),
    },
    auth: {
      rateLimitWindowSeconds: int('AUTH_RATE_LIMIT_WINDOW_SECONDS', 300),
      rateLimitMax: int('AUTH_RATE_LIMIT_MAX', 10),
      passwordResetTtlMinutes: int('PASSWORD_RESET_TTL_MINUTES', 30),
    },
  };
}
