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
    /** Dapat dimatikan sebagai accepted deployment risk; default tetap aman. */
    requireMasterMfa: boolean;
    mfaIssuer: string;
    /** Kunci AES-256 dalam base64 untuk rahasia TOTP. */
    mfaEncryptionKey: string;
  };
  video: {
    provider: 'SELF_HOSTED' | 'BUNNY_STREAM';
    storagePath: string;
    maxUploadBytes: number;
    playbackTtlSeconds: number;
  };
  avatar: {
    storagePath: string;
    maxUploadBytes: number;
  };
  courseThumbnail: {
    storagePath: string;
    maxUploadBytes: number;
  };
  /**
   * Bukan lagi bagian commerce: aktivasi akun dan pemulihan password sama-sama
   * memakainya, sehingga identity tidak perlu bergantung pada modul commerce.
   */
  email: {
    provider: 'RESEND' | 'DISABLED';
    apiKey?: string;
    fromName: string;
    fromAddress?: string;
  };
  /** Pembatas laju yang berlaku untuk seluruh API (SECURITY_CONTROLS §5). */
  rateLimit: {
    /** Dimatikan pada test; 230 e2e dari satu alamat akan menabrak batasnya. */
    enabled: boolean;
    max: number;
    windowSeconds: number;
  };
  /** Batas ukuran body JSON (SECURITY_CONTROLS §3). */
  maxRequestBodyBytes: number;
  announcement: {
    /**
     * Pekerjaan latar yang memberitahukan pengumuman terjadwal.
     *
     * Dapat dimatikan agar test dapat memanggil satu siklus secara manual;
     * poller latar akan berlomba dengan test dan membuat hasilnya tidak pasti.
     */
    schedulerEnabled: boolean;
    schedulerIntervalSeconds: number;
  };
  /** Pemantauan galat runtime, PRD 12.7. */
  observability: {
    /** Penerima peringatan galat; kosong berarti hanya dicatat, tanpa surat. */
    alertTo?: string;
    /** Batas surat per jam, agar satu insiden tidak membanjiri kotak masuk. */
    alertMaxPerHour: number;
    /** Batas laporan galat browser per IP per jam. */
    clientReportMaxPerHour: number;
  };
  commerce: {
    orderTtlMinutes: number;
    midtrans: {
      environment: 'SANDBOX' | 'PRODUCTION';
      serverKey?: string;
      clientKey?: string;
    };
    whatsApp: {
      provider: 'META_CLOUD' | 'DISABLED';
      graphApiVersion: string;
      phoneNumberId?: string;
      accessToken?: string;
      activationTemplateName: string;
      templateLanguage: string;
      /**
       * Rahasia aplikasi Meta, dipakai memverifikasi `X-Hub-Signature-256`
       * pada webhook status pengantaran. Tanpa nilai ini webhooknya ditolak:
       * endpoint publik yang menulis ke basis data tidak boleh mempercayai
       * badan permintaan yang tidak dapat dibuktikan asalnya.
       */
      appSecret?: string;
      /** Token yang dicocokkan Meta saat memasang URL webhook. */
      webhookVerifyToken?: string;
    };
  };
}

export function loadConfig(): AppConfig {
  const sameSite = (process.env.SESSION_COOKIE_SAME_SITE ?? 'lax') as SameSite;
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('SESSION_COOKIE_SAME_SITE harus lax, strict, atau none.');
  }
  const videoProvider = process.env.VIDEO_PROVIDER ?? 'SELF_HOSTED';
  if (!['SELF_HOSTED', 'BUNNY_STREAM'].includes(videoProvider)) {
    throw new Error('VIDEO_PROVIDER harus SELF_HOSTED atau BUNNY_STREAM.');
  }
  const midtransEnvironment = process.env.MIDTRANS_ENVIRONMENT ?? 'SANDBOX';
  if (!['SANDBOX', 'PRODUCTION'].includes(midtransEnvironment)) {
    throw new Error('MIDTRANS_ENVIRONMENT harus SANDBOX atau PRODUCTION.');
  }
  const emailProvider = process.env.EMAIL_PROVIDER ?? 'DISABLED';
  if (!['RESEND', 'DISABLED'].includes(emailProvider)) {
    throw new Error('EMAIL_PROVIDER harus RESEND atau DISABLED.');
  }
  const whatsAppProvider = process.env.WHATSAPP_PROVIDER ?? 'DISABLED';
  if (!['META_CLOUD', 'DISABLED'].includes(whatsAppProvider)) {
    throw new Error('WHATSAPP_PROVIDER harus META_CLOUD atau DISABLED.');
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
      requireMasterMfa: bool('REQUIRE_MASTER_MFA', true),
      mfaIssuer: process.env.MFA_ISSUER ?? 'LMS Akademi Online',
      mfaEncryptionKey: required('MFA_ENCRYPTION_KEY'),
    },
    video: {
      provider: videoProvider as 'SELF_HOSTED' | 'BUNNY_STREAM',
      storagePath: process.env.VIDEO_STORAGE_PATH ?? '/data/videos',
      maxUploadBytes: int('VIDEO_MAX_UPLOAD_BYTES', 2_147_483_648),
      playbackTtlSeconds: int('VIDEO_PLAYBACK_TTL_SECONDS', 300),
    },
    avatar: {
      storagePath: process.env.AVATAR_STORAGE_PATH ?? '/data/avatars',
      maxUploadBytes: int('AVATAR_MAX_UPLOAD_BYTES', 5_242_880),
    },
    courseThumbnail: {
      storagePath: process.env.COURSE_THUMBNAIL_STORAGE_PATH ?? '/data/course-thumbnails',
      maxUploadBytes: int('COURSE_THUMBNAIL_MAX_UPLOAD_BYTES', 5_242_880),
    },
    email: {
      provider: emailProvider as 'RESEND' | 'DISABLED',
      apiKey: process.env.RESEND_API_KEY || undefined,
      fromName: process.env.EMAIL_FROM_NAME ?? 'Academy AIPreneur',
      fromAddress: process.env.EMAIL_FROM_ADDRESS || undefined,
    },
    rateLimit: {
      enabled: bool('RATE_LIMIT_ENABLED', true),
      max: int('RATE_LIMIT_MAX', 240),
      windowSeconds: int('RATE_LIMIT_WINDOW_SECONDS', 60),
    },
    maxRequestBodyBytes: int('MAX_REQUEST_BODY_BYTES', 262_144),
    announcement: {
      schedulerEnabled: bool('ANNOUNCEMENT_SCHEDULER_ENABLED', true),
      schedulerIntervalSeconds: int('ANNOUNCEMENT_SCHEDULER_INTERVAL_SECONDS', 60),
    },
    observability: {
      alertTo: process.env.ERROR_ALERT_TO || undefined,
      alertMaxPerHour: int('ERROR_ALERT_MAX_PER_HOUR', 10),
      clientReportMaxPerHour: int('CLIENT_ERROR_MAX_PER_HOUR', 30),
    },
    commerce: {
      orderTtlMinutes: int('REGISTRATION_ORDER_TTL_MINUTES', 1_440),
      midtrans: {
        environment: midtransEnvironment as 'SANDBOX' | 'PRODUCTION',
        serverKey: process.env.MIDTRANS_SERVER_KEY || undefined,
        clientKey: process.env.MIDTRANS_CLIENT_KEY || undefined,
      },
      whatsApp: {
        provider: whatsAppProvider as 'META_CLOUD' | 'DISABLED',
        graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v23.0',
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || undefined,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN || undefined,
        activationTemplateName:
          process.env.WHATSAPP_ACTIVATION_TEMPLATE_NAME ?? 'academy_account_activation',
        templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'id',
        appSecret: process.env.WHATSAPP_APP_SECRET || undefined,
        webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || undefined,
      },
    },
  };
}
