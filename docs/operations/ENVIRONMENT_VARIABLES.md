# Environment Variables

Dokumen ini mendefinisikan nama dan tujuan environment variable. Nilai secret tidak boleh disimpan di Git.

## Application

```text
NODE_ENV
APP_ENV
APP_NAME
APP_URL
WEB_URL
API_URL
PORT
LOG_LEVEL
```

## Database

```text
DATABASE_URL
DATABASE_POOL_MIN
DATABASE_POOL_MAX
DATABASE_STATEMENT_TIMEOUT_MS
POSTGRES_HOST_PORT
```

`POSTGRES_HOST_PORT` default ke `5433` dan hanya di-bind ke loopback VPS untuk
akses administratif melalui SSH tunnel. Jangan bind PostgreSQL ke `0.0.0.0`.

## Redis

```text
REDIS_URL
REDIS_SESSION_PREFIX
REDIS_CACHE_PREFIX
REDIS_QUEUE_PREFIX
SESSION_IDLE_TTL_SECONDS
SESSION_ABSOLUTE_TTL_SECONDS
```

## Authentication

```text
SESSION_COOKIE_NAME
SESSION_COOKIE_DOMAIN
SESSION_COOKIE_SECURE
SESSION_COOKIE_SAME_SITE
CSRF_COOKIE_NAME
PASSWORD_RESET_TTL_MINUTES
REQUIRE_MASTER_MFA
MFA_ISSUER
AUTH_RATE_LIMIT_WINDOW_SECONDS
AUTH_RATE_LIMIT_MAX
```

`REQUIRE_MASTER_MFA` default `true`. Nilai `false` melewati setup dan
verifikasi TOTP untuk role Master. Gunakan hanya sebagai accepted deployment
risk, batasi akses administratif, dan pertahankan rate limit serta kata sandi
unik yang kuat.

## Object Storage

```text
STORAGE_PROVIDER
STORAGE_ENDPOINT
STORAGE_REGION
STORAGE_BUCKET_PRIVATE
STORAGE_BUCKET_PUBLIC
STORAGE_ACCESS_KEY_ID
STORAGE_SECRET_ACCESS_KEY
SIGNED_URL_TTL_SECONDS
MAX_UPLOAD_SIZE_BYTES
```

## Email

```text
EMAIL_PROVIDER
EMAIL_FROM_NAME
EMAIL_FROM_ADDRESS
EMAIL_API_KEY
EMAIL_SANDBOX_MODE
```

## Video

```text
VIDEO_PROVIDER
VIDEO_STORAGE_PATH
VIDEO_MAX_UPLOAD_BYTES
VIDEO_PLAYBACK_TTL_SECONDS
VIDEO_API_BASE_URL
VIDEO_API_KEY
VIDEO_WEBHOOK_SECRET
VIDEO_PLAYBACK_TOKEN_TTL_SECONDS
```

## Avatar

```text
AVATAR_STORAGE_PATH
AVATAR_MAX_UPLOAD_BYTES
```

Default produksi menyimpan avatar pada volume persisten terpisah di
`/data/avatars` dengan batas 5 MiB.

## Course Thumbnail

```text
COURSE_THUMBNAIL_STORAGE_PATH
COURSE_THUMBNAIL_MAX_UPLOAD_BYTES
```

Default produksi menyimpan thumbnail kursus pada volume persisten terpisah di
`/data/course-thumbnails` dengan batas 5 MiB.

## Queue

```text
QUEUE_CONCURRENCY_CRITICAL
QUEUE_CONCURRENCY_NOTIFICATIONS
QUEUE_CONCURRENCY_ANALYTICS
QUEUE_CONCURRENCY_REPORTS
QUEUE_CONCURRENCY_MEDIA
QUEUE_CONCURRENCY_AI
QUEUE_CONCURRENCY_MAINTENANCE
```

## AI

```text
AI_SERVICE_URL
AI_SERVICE_SHARED_SECRET
AI_PROVIDER
AI_PROVIDER_API_KEY
AI_DEFAULT_MODEL
AI_MAX_COST_PER_JOB
AI_REQUEST_TIMEOUT_MS
```

## Rate Limiting

Pembatas laju yang berlaku untuk seluruh API (SECURITY_CONTROLS §5a).

```text
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=240
RATE_LIMIT_WINDOW_SECONDS=60
MAX_REQUEST_BODY_BYTES=262144
```

Dihitung per alamat, bukan per pengguna: guard-nya berjalan sebelum sesi
diperiksa, supaya jalur login ikut terlindungi. Endpoint mahal punya anggaran
sendiri lewat dekorator `@RateLimit`, jadi pencarian tidak menghabiskan jatah
menjelajah biasa.

`RATE_LIMIT_ENABLED=false` hanya untuk test; 235 permintaan dari satu alamat
akan menabrak batasnya.

## Announcement

Penjadwal yang memberitahukan pengumuman terjadwal saat waktunya tiba (PRD
7.13). Berupa poller di dalam proses API, bukan pekerjaan worker terpisah.

```text
ANNOUNCEMENT_SCHEDULER_ENABLED=true
ANNOUNCEMENT_SCHEDULER_INTERVAL_SECONDS=60
```

Jeda ini menentukan seberapa terlambat sebuah notifikasi terjadwal boleh
dikirim. Mematikannya membuat pengumuman terjadwal tetap tampil saat waktunya,
tetapi tanpa notifikasi. Test end-to-end mematikannya dan memanggil satu siklus
secara manual, karena poller latar akan berlomba dengan test.

## Observability

Pemantauan galat runtime (PRD 12.7). Galat disimpan di `error_events` dan dibaca
Master pada `/master/errors`; rinciannya di
`docs/operations/INCIDENT_RESPONSE.md` §0a.

```text
ERROR_ALERT_TO
ERROR_ALERT_MAX_PER_HOUR=10
CLIENT_ERROR_MAX_PER_HOUR=30
```

`ERROR_ALERT_TO` kosong berarti galat tetap dicatat tetapi tidak ada surat yang
dikirim. Pengirimannya memakai konfigurasi Email di bawah, jadi
`EMAIL_PROVIDER=DISABLED` juga mematikan peringatan ini.

`ERROR_ALERT_MAX_PER_HOUR` membatasi jumlah surat per jam. Satu insiden dapat
memunculkan puluhan galat berbeda sekaligus; tanpa batas ini kotak masuk
penerimanya penuh dan justru berhenti dibaca.

`CLIENT_ERROR_MAX_PER_HOUR` membatasi laporan galat browser per IP. Endpointnya
publik karena galat pada halaman login dan pendaftaran terjadi sebelum ada sesi.

Worker membaca `ERROR_ALERT_TO`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, dan
`EMAIL_FROM_NAME` langsung dari environment — ia tidak memakai modul email milik
API. Bila salah satunya kosong, kegagalan job tetap tercatat tanpa surat.

Belum terpasang, disebut di sini agar tidak dikira sudah ada: `OTEL_SERVICE_NAME`,
`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `SENTRY_DSN`,
`METRICS_ENABLED`.

## Email

Dipakai lintas modul, bukan hanya pendaftaran: aktivasi akun dan pemulihan
password sama-sama melewatinya (ADR-022). `EMAIL_PROVIDER=DISABLED` membuat
pengiriman menjadi `SKIPPED` tanpa menjatuhkan alur mana pun.

```text
EMAIL_PROVIDER=DISABLED
RESEND_API_KEY
EMAIL_FROM_NAME=AIPreneur Academy
EMAIL_FROM_ADDRESS
```

## Registration Commerce

```text
REGISTRATION_ORDER_TTL_MINUTES=1440
MIDTRANS_ENVIRONMENT=SANDBOX
MIDTRANS_SERVER_KEY
MIDTRANS_CLIENT_KEY

WHATSAPP_PROVIDER=DISABLED
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_ACTIVATION_TEMPLATE_NAME=academy_account_activation
WHATSAPP_TEMPLATE_LANGUAGE=id
```

`MIDTRANS_SERVER_KEY`, `RESEND_API_KEY`, dan `WHATSAPP_ACCESS_TOKEN` adalah
secret backend. Mulai dengan `MIDTRANS_ENVIRONMENT=SANDBOX`. Provider email dan
WhatsApp sengaja default `DISABLED` agar deployment tetap sehat sebelum akun
provider siap.

## Security Rules

- `.env.example` hanya berisi placeholder.
- Secret tidak dicetak pada startup log.
- Secret production berbeda dari staging.
- Key rotation terdokumentasi.
- AI dan video webhook secret divalidasi.
- `DATABASE_URL` dan `REDIS_URL` tidak dikirim ke browser.

## Bunny Stream

```text
VIDEO_PROVIDER=BUNNY_STREAM
BUNNY_STREAM_LIBRARY_ID
BUNNY_STREAM_API_KEY
BUNNY_STREAM_CDN_HOSTNAME
BUNNY_STREAM_TOKEN_AUTH_KEY
BUNNY_STREAM_WEBHOOK_SECRET
BUNNY_STREAM_TOKEN_TTL_SECONDS=300
BUNNY_STREAM_ALLOWED_DOMAINS
BUNNY_STREAM_DRM_ENABLED=true
BUNNY_STREAM_DRM_TYPE=MEDIACAGE_BASIC
VIDEO_MAX_UPLOAD_SIZE_BYTES
VIDEO_ALLOWED_MIME_TYPES
VIDEO_MAX_CONCURRENT_PLAYBACKS=1
VIDEO_PLAYBACK_HEARTBEAT_SECONDS=45
```

Semua Bunny secret hanya tersedia di backend atau secret manager. Tidak ada secret yang memakai prefix `NEXT_PUBLIC_`.
