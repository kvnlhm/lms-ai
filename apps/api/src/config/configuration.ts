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
    /**
     * Client ID OAuth Google, sekaligus `aud` yang dituntut pada ID token.
     * Kosong berarti masuk dengan Google dimatikan — bukan diterima tanpa
     * pemeriksaan.
     */
    googleClientId: string;
  };
  video: {
    provider: 'SELF_HOSTED' | 'BUNNY_STREAM';
    storagePath: string;
    maxUploadBytes: number;
    playbackTtlSeconds: number;
    /**
     * Bunny Stream dipakai per aset, bukan global: `video_assets.provider`
     * menentukan asal setiap video. Konfigurasi ini hanya perlu terisi bila
     * ada aset yang memakainya, sehingga perpustakaan self-hosted yang sudah
     * ada tetap berjalan tanpa satu pun nilai di bawah ini.
     */
    bunny: {
      libraryId?: string;
      /** Hostname pull zone, misalnya `vz-xxxxxxxx-xxx.b-cdn.net`. */
      cdnHostname?: string;
      apiKey?: string;
      /**
       * Kunci penanda tangan URL. Selama kosong, perlindungan bersandar pada
       * pembatasan referrer di sisi Bunny — cukup untuk menahan hotlink biasa,
       * tetapi referrer dapat dipalsukan.
       */
      tokenAuthKey?: string;
      /**
       * Memeriksa sekali saat proses hidup apakah URL yang kita susun benar-benar
       * diterima CDN.
       *
       * Ada dua setelan yang harus sepakat dan tidak dapat saling melihat:
       * `tokenAuthKey` di sini, dan "CDN token authentication" di dashboard
       * Bunny. Bila hanya salah satu menyala, setiap pemutaran gagal — dan
       * gagalnya diam-diam, karena yang dilihat pelajar cuma video yang tidak
       * mau jalan. Pemeriksaan ini yang membuat ketidaksepakatan itu muncul di
       * log begitu proses hidup, bukan berminggu-minggu kemudian lewat keluhan.
       */
      startupCheckEnabled: boolean;
    };
  };
  avatar: {
    storagePath: string;
    maxUploadBytes: number;
  };
  courseThumbnail: {
    storagePath: string;
    maxUploadBytes: number;
  };
  /** Berkas materi pelajaran, mis. PDF. Tidak pernah punya URL publik. */
  lessonMaterial: {
    storagePath: string;
    maxUploadBytes: number;
  };
  communityAttachment: {
    storagePath: string;
    maxUploadBytes: number;
    maxDraftUploadBytes: number;
    maxPerPost: number;
  };
  /**
   * Penyapu unggahan yang tidak pernah selesai.
   *
   * Setiap unggahan ditulis ke berkas `.uploading` lalu di-`rename` begitu utuh.
   * Blok `catch` pengunggah membersihkannya bila unggahannya gagal — tetapi hanya
   * bila prosesnya masih hidup untuk menjalankannya. Ketika kontainer diganti di
   * tengah unggahan, berkas separuh jadi itu tidak ada lagi yang membuang.
   */
  upload: {
    /** Dimatikan pada test agar poller tidak berlomba dengan berkas milik test. */
    sweeperEnabled: boolean;
    sweeperIntervalSeconds: number;
    /**
     * Umur minimum sebuah `.uploading` sebelum dianggap terbengkalai.
     *
     * Harus melampaui unggahan sah paling lambat yang masuk akal: video 2 GB
     * pada koneksi 1 Mbps memakan sekitar lima jam. Enam jam memberi kelonggaran
     * tanpa membiarkan sampahnya menginap berhari-hari.
     */
    staleAfterSeconds: number;
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
    /**
     * Rahasia penanda tangan webhook Resend (berawalan `whsec_`), dipakai
     * memverifikasi header Svix pada tanda terima pengantaran. Tanpa nilai ini
     * webhooknya ditolak: endpoint publik yang menulis ke basis data tidak
     * boleh mempercayai badan permintaan yang tidak dapat dibuktikan asalnya.
     */
    webhookSigningSecret?: string;
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
  const appEnv = process.env.APP_ENV ?? 'local';
  const videoProvider = process.env.VIDEO_PROVIDER ?? 'SELF_HOSTED';
  if (!['SELF_HOSTED', 'BUNNY_STREAM'].includes(videoProvider)) {
    throw new Error('VIDEO_PROVIDER harus SELF_HOSTED atau BUNNY_STREAM.');
  }
  const midtransEnvironment = process.env.MIDTRANS_ENVIRONMENT ?? 'SANDBOX';
  if (!['SANDBOX', 'PRODUCTION'].includes(midtransEnvironment)) {
    throw new Error('MIDTRANS_ENVIRONMENT harus SANDBOX atau PRODUCTION.');
  }
  /**
   * Kredensial pembayaran sungguhan hanya boleh hidup di produksi.
   *
   * Staging biasanya lahir sebagai salinan produksi, dan salinan itu membawa
   * seluruh env-nya — termasuk kunci Midtrans PRODUCTION. Akibatnya bukan
   * sekadar data uji yang kotor: checkout di staging akan benar-benar menagih
   * kartu orang, dan webhook-nya akan membuatkan akun di database staging
   * sementara pembelinya menunggu akses di produksi.
   *
   * Karena itu ini menolak boot, bukan sekadar memperingatkan. Aplikasi yang
   * mati saat dinyalakan jauh lebih murah daripada aplikasi yang menerima uang
   * secara diam-diam.
   */
  if (appEnv !== 'production' && midtransEnvironment === 'PRODUCTION') {
    throw new Error(
      `MIDTRANS_ENVIRONMENT=PRODUCTION tidak diizinkan saat APP_ENV=${appEnv}. ` +
        'Gunakan kunci SANDBOX di lingkungan non-produksi.',
    );
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
    env: appEnv,
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
      googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    },
    video: {
      provider: videoProvider as 'SELF_HOSTED' | 'BUNNY_STREAM',
      storagePath: process.env.VIDEO_STORAGE_PATH ?? '/data/videos',
      maxUploadBytes: int('VIDEO_MAX_UPLOAD_BYTES', 2_147_483_648),
      playbackTtlSeconds: int('VIDEO_PLAYBACK_TTL_SECONDS', 300),
      bunny: {
        libraryId: process.env.BUNNY_STREAM_LIBRARY_ID || undefined,
        cdnHostname: process.env.BUNNY_STREAM_CDN_HOSTNAME || undefined,
        apiKey: process.env.BUNNY_STREAM_API_KEY || undefined,
        tokenAuthKey: process.env.BUNNY_STREAM_TOKEN_AUTH_KEY || undefined,
        startupCheckEnabled: bool('BUNNY_STREAM_STARTUP_CHECK_ENABLED', true),
      },
    },
    avatar: {
      storagePath: process.env.AVATAR_STORAGE_PATH ?? '/data/avatars',
      maxUploadBytes: int('AVATAR_MAX_UPLOAD_BYTES', 5_242_880),
    },
    courseThumbnail: {
      storagePath: process.env.COURSE_THUMBNAIL_STORAGE_PATH ?? '/data/course-thumbnails',
      maxUploadBytes: int('COURSE_THUMBNAIL_MAX_UPLOAD_BYTES', 5_242_880),
    },
    lessonMaterial: {
      storagePath: process.env.LESSON_MATERIAL_STORAGE_PATH ?? '/data/materials',
      maxUploadBytes: int('LESSON_MATERIAL_MAX_UPLOAD_BYTES', 52_428_800),
    },
    communityAttachment: {
      storagePath: process.env.COMMUNITY_ATTACHMENT_STORAGE_PATH ?? '/data/community-attachments',
      // Lampiran checklist: 100 MB, tidak berubah. Ia dikurasi Master dan
      // jumlahnya terbatas pada langkah checklist yang memang sedikit.
      maxUploadBytes: int('COMMUNITY_ATTACHMENT_MAX_UPLOAD_BYTES', 104_857_600),
      // Lampiran postingan biasa: 10 MB, dan sepuluh berkas per postingan. Batasnya
      // lebih ketat karena di sini Pelajar ikut mengunggah, di setiap postingan,
      // ke disk VPS yang juga menampung basis data beserta cadangannya.
      maxDraftUploadBytes: int('COMMUNITY_ATTACHMENT_MAX_DRAFT_UPLOAD_BYTES', 10_485_760),
      maxPerPost: int('COMMUNITY_ATTACHMENT_MAX_PER_POST', 10),
    },
    upload: {
      sweeperEnabled: bool('UPLOAD_SWEEPER_ENABLED', true),
      sweeperIntervalSeconds: int('UPLOAD_SWEEPER_INTERVAL_SECONDS', 900),
      staleAfterSeconds: int('UPLOAD_STALE_AFTER_SECONDS', 21_600),
    },
    email: {
      provider: emailProvider as 'RESEND' | 'DISABLED',
      apiKey: process.env.RESEND_API_KEY || undefined,
      fromName: process.env.EMAIL_FROM_NAME ?? 'Academy AIPreneur',
      fromAddress: process.env.EMAIL_FROM_ADDRESS || undefined,
      webhookSigningSecret: process.env.RESEND_WEBHOOK_SIGNING_SECRET || undefined,
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
