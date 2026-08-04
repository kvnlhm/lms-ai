#!/usr/bin/env bash
#
# Mengambil satu checkpoint backup: dump database plus arsip volume unggahan.
#
# Database dan volume diambil berurutan tanpa jeda panjang supaya keduanya
# dapat direkonsiliasi lewat `video_asset_id` dan object key seperti yang
# diminta docs/operations/BACKUP_RESTORE.md §4. Dump diambil lebih dulu; file
# yang menyusul setelahnya hanya membuat volume berisi lebih banyak, tidak
# lebih sedikit, sehingga tidak ada baris database yang menunjuk file hilang.
#
# Setiap checkpoint berdiri sendiri: satu file tar berisi dump, arsip volume,
# dan MANIFEST yang mencatat checksum, versi migrasi, serta jumlah baris tabel
# inti. MANIFEST itulah yang dipakai saat restore drill untuk membuktikan
# salinannya utuh.
#
# Kegagalan mengirim email peringatan. Backup yang diam saat gagal sama saja
# dengan tidak ada backup: kegagalannya baru ketahuan pada saat paling buruk,
# yaitu ketika salinannya dibutuhkan. Keberhasilan sengaja tidak mengirim
# apa-apa — surat rutin yang selalu datang justru melatih orang mengabaikannya.
#
# Checkpoint juga diunggah ke penyimpanan objek di luar server bila
# dikonfigurasi. Tanpa itu database dan seluruh salinannya berada pada disk yang
# sama, sehingga satu kegagalan disk menghapus keduanya sekaligus.
#
# Pemakaian:
#   backup.sh                # ambil checkpoint, pangkas, lalu unggah offsite
#   backup.sh --prune-only   # hanya pangkas yang lokal
#   backup.sh --test-alert   # kirim satu peringatan contoh, lalu berhenti
#   backup.sh --test-offsite # uji tulis, baca, dan hapus ke penyimpanan objek
#
set -Eeuo pipefail

# UUID resource Coolify sengaja tidak diberi nilai default: repository ini
# publik, dan identitas deployment tidak perlu ikut terbit di dalamnya.
APP_UUID="${LMS_APP_UUID:-}"
BACKUP_ROOT="${LMS_BACKUP_ROOT:-/var/backups/lms-ai}"
LOG_FILE="${LMS_BACKUP_LOG:-$BACKUP_ROOT/backup.log}"

# Sesuai retention baseline pada BACKUP_RESTORE.md §3.
DAILY_KEEP="${LMS_DAILY_KEEP:-14}"
WEEKLY_KEEP="${LMS_WEEKLY_KEEP:-8}"
MONTHLY_KEEP="${LMS_MONTHLY_KEEP:-12}"

VOLUMES=(video-data avatar-data course-thumbnail-data material-data)
COUNTED_TABLES=(users enrollments lesson_progress registration_orders video_assets forum_topics)

ALERT_TO="${LMS_ALERT_TO:-}"
ALERT_FROM="${LMS_ALERT_FROM:-Academy AIPreneur Alerts <alerts@send.aipreneur.co.id>}"

# Salinan di luar server, memenuhi BACKUP_RESTORE.md §1: backup yang hanya ada
# di disk yang sama dengan databasenya bukan backup terhadap kegagalan disk.
#
# Kredensial dibaca dari environment, tidak pernah dari repository ini — repo
# ini publik. Cron memuatnya dari /etc/lms-backup.env yang hanya dapat dibaca
# root. Bila salah satu kosong, unggahan dilewati dengan catatan di log,
# sehingga skrip ini tetap berguna sebelum tujuan offsite dipasang.
S3_ENDPOINT="${LMS_S3_ENDPOINT:-}"
S3_BUCKET="${LMS_S3_BUCKET:-}"
S3_ACCESS_KEY_ID="${LMS_S3_ACCESS_KEY_ID:-}"
S3_SECRET_ACCESS_KEY="${LMS_S3_SECRET_ACCESS_KEY:-}"
# R2 tidak punya region sungguhan; `auto` adalah nilai yang diminta Cloudflare.
S3_REGION="${LMS_S3_REGION:-auto}"
S3_PREFIX="${LMS_S3_PREFIX:-daily}"
OFFSITE_KEEP="${LMS_OFFSITE_KEEP:-30}"
# `penuh` mengunduh kembali objeknya lalu membandingkan sha256 dengan berkas
# lokal — satu-satunya pemeriksaan yang benar-benar membuktikan byte-nya utuh
# di sana. `ukuran` hanya membandingkan jumlah byte, untuk arsip yang sudah
# terlalu besar untuk diunduh setiap malam.
OFFSITE_VERIFY="${LMS_OFFSITE_VERIFY:-penuh}"
RCLONE_IMAGE="${LMS_RCLONE_IMAGE:-rclone/rclone:1.68}"

# Frasa sandi untuk mengenkripsi arsip sebelum meninggalkan server ini.
#
# Kosong berarti arsip diunggah apa adanya — perilaku lama, supaya memasang
# skrip ini tidak pernah menghentikan backup yang sudah berjalan. Tetapi
# penyimpanan objek adalah pihak ketiga, dan isi arsip ini mencakup seluruh
# basis data: nama, email, nomor telepon, dan riwayat belajar setiap pelajar.
BACKUP_PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE" >&2
}

# Kunci Resend dibaca dari container API yang sedang berjalan, bukan disimpan
# lagi di crontab atau berkas terpisah. Satu salinan rahasia lebih sedikit
# untuk dijaga, dan otomatis ikut ketika kuncinya dirotasi.
resend_key() {
  local api
  api="$(docker ps --format '{{.Names}}' | grep -E "^api-${APP_UUID}(-|\$)" | head -1 || true)"
  # Cadangan tanpa UUID: justru ketika UUID-nya salah backup akan gagal, dan
  # saat itulah peringatannya paling dibutuhkan. Membaca kunci dari container
  # API mana pun yang berjalan sudah cukup untuk mengirim satu surat.
  [[ -n "$api" ]] || api="$(docker ps --format '{{.Names}}' | grep '^api-' | head -1 || true)"
  [[ -n "$api" ]] || return 1
  docker exec "$api" printenv RESEND_API_KEY 2>/dev/null | tr -d '\r\n'
}

# Penandanya berupa berkas, bukan variabel. `die` sering dipanggil dari dalam
# command substitution — misalnya `X="$(resolve_container ...)"` — yang berjalan
# di subshell, sehingga variabel apa pun yang diset di sana lenyap begitu
# subshellnya berakhir. Trap ERR di shell induk lalu ikut menyala dan surat
# kedua terkirim untuk kegagalan yang sama.
ALERT_FLAG="${TMPDIR:-/tmp}/lms-backup-alerted.$$"

alert() {
  local subject="$1" detail="$2" key
  [[ ! -e "$ALERT_FLAG" ]] || return 0
  : >"$ALERT_FLAG"
  [[ -n "$ALERT_TO" ]] || { log "peringatan tidak dikirim: LMS_ALERT_TO belum diset."; return 0; }
  key="$(resend_key || true)"
  [[ -n "$key" ]] || { log "peringatan tidak dikirim: kunci Resend tidak terbaca."; return 0; }

  # Dirakit lewat python3, bukan sambung-menyambung string: pesan galat dapat
  # memuat kutip atau baris baru yang akan merusak JSON bila ditempel mentah.
  local payload
  payload="$(
    SUBJ="$subject" DETAIL="$detail" TO="$ALERT_TO" FROM="$ALERT_FROM" \
    HOST="$(hostname)" LOGPATH="$LOG_FILE" STAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    python3 - <<'PY'
import html, json, os
subject = os.environ["SUBJ"]
body = (
    f"<p><strong>{html.escape(subject)}</strong></p>"
    f"<p>Server: {html.escape(os.environ['HOST'])}<br>Waktu: {os.environ['STAMP']}</p>"
    f"<pre>{html.escape(os.environ['DETAIL'])}</pre>"
    f"<p>Log lengkap ada di <code>{html.escape(os.environ['LOGPATH'])}</code> pada server itu.</p>"
)
print(json.dumps({
    "from": os.environ["FROM"],
    "to": [os.environ["TO"]],
    "subject": subject,
    "html": body,
}))
PY
  )"

  if curl -fsS -m 20 -X POST https://api.resend.com/emails \
      -H "Authorization: Bearer ${key}" -H 'Content-Type: application/json' \
      -d "$payload" >/dev/null 2>&1; then
    log "peringatan terkirim ke ${ALERT_TO}."
  else
    log "peringatan GAGAL dikirim; hanya tercatat di log."
  fi
}

die() {
  log "GAGAL: $*"
  alert "Backup LMS gagal" "$*"
  exit 1
}

# Kegagalan tak terduga — perintah yang error tanpa lewat `die` — tetap harus
# memicu peringatan, bukan berakhir sunyi di log. Yang sudah dilaporkan `die`
# tersaring oleh penjaga di dalam `alert`.
trap 'code=$?; [[ $code -eq 0 ]] || { log "GAGAL tak terduga, keluar dengan kode ${code}."; alert "Backup LMS gagal" "Perintah berhenti dengan kode ${code}. Rincian ada di log."; }' ERR

# Nama container berubah setiap deploy Coolify, jadi selalu diselesaikan lewat
# prefiks. Kalau hasilnya bukan tepat satu, lebih baik berhenti daripada
# membackup container yang salah.
resolve_container() {
  local prefix="$1" matches
  matches="$(docker ps --format '{{.Names}}' | grep -E "^${prefix}(-|\$)" || true)"
  [[ -n "$matches" ]] || die "container dengan prefiks '${prefix}' tidak berjalan."
  [[ "$(wc -l <<<"$matches")" -eq 1 ]] || die "container '${prefix}' lebih dari satu:\n${matches}"
  printf '%s' "$matches"
}

prune_bucket() {
  local dir="$1" keep="$2" removed=0
  # `ls -1` aman di sini: nama file dihasilkan skrip ini sendiri dan hanya
  # berisi angka, huruf, serta tanda hubung.
  while read -r stale; do
    [[ -n "$stale" ]] || continue
    rm -f -- "$dir/$stale"
    removed=$((removed + 1))
  # `|| true` wajib: dengan `pipefail`, `grep` yang tidak menemukan apa pun
  # membuat seluruh pipeline berstatus gagal. Keranjang weekly dan monthly
  # memang kosong sampai hari Minggu atau tanggal 1 pertama tiba, sehingga
  # backup yang sepenuhnya berhasil ikut memicu trap ERR dan mengirim
  # peringatan palsu. Alarm yang berbohong lebih cepat diabaikan daripada
  # tidak ada alarm sama sekali.
  done < <(ls -1 "$dir" 2>/dev/null | grep -E '^lms-[0-9]{8}T[0-9]{6}Z\.tar$' | sort -r | tail -n "+$((keep + 1))" || true)
  [[ "$removed" -eq 0 ]] || log "pangkas $(basename "$dir"): $removed checkpoint dihapus."
}

offsite_dikonfigurasi() {
  [[ -n "$S3_ENDPOINT" && -n "$S3_BUCKET" && -n "$S3_ACCESS_KEY_ID" && -n "$S3_SECRET_ACCESS_KEY" ]]
}

# Menjalankan rclone di dalam container, karena VPS ini tidak memasang rclone
# dan tidak perlu memasangnya.
#
# Rahasia diteruskan dengan `-e NAMA` tanpa nilai, sehingga docker mengambilnya
# dari environment proses ini. Bentuk `-e NAMA=nilai` akan menaruh kunci pada
# baris perintah, tempat siapa pun yang menjalankan `ps` dapat membacanya.
rclone_jalan() {
  local mount_args=()
  if [[ -n "${1:-}" && "$1" == "--mount" ]]; then
    mount_args=(-v "$2:$3:ro")
    shift 3
  fi
  RCLONE_CONFIG_OFFSITE_TYPE=s3 \
  RCLONE_CONFIG_OFFSITE_PROVIDER=Cloudflare \
  RCLONE_CONFIG_OFFSITE_ENV_AUTH=false \
  RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
  RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  RCLONE_CONFIG_OFFSITE_ENDPOINT="$S3_ENDPOINT" \
  RCLONE_CONFIG_OFFSITE_REGION="$S3_REGION" \
  docker run --rm --network host "${mount_args[@]}" \
    -e RCLONE_CONFIG_OFFSITE_TYPE \
    -e RCLONE_CONFIG_OFFSITE_PROVIDER \
    -e RCLONE_CONFIG_OFFSITE_ENV_AUTH \
    -e RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID \
    -e RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY \
    -e RCLONE_CONFIG_OFFSITE_ENDPOINT \
    -e RCLONE_CONFIG_OFFSITE_REGION \
    --entrypoint rclone "$RCLONE_IMAGE" "$@"
}

# Menghapus salinan offsite terlama, meniru aturan yang sama dengan lokal.
# Dijalankan setelah unggahan berhasil, bukan sebelumnya: memangkas lebih dulu
# akan mengurangi jumlah salinan justru pada malam ketika unggahan gagal.
offsite_pangkas() {
  local daftar hapus jumlah=0
  daftar="$(rclone_jalan lsf "offsite:${S3_BUCKET}/${S3_PREFIX}" 2>/dev/null |
    grep -E '^lms-[0-9]{8}T[0-9]{6}Z\.tar(\.gpg)?$' | sort -r || true)"
  hapus="$(printf '%s\n' "$daftar" | tail -n "+$((OFFSITE_KEEP + 1))" || true)"
  while read -r objek; do
    [[ -n "$objek" ]] || continue
    rclone_jalan deletefile "offsite:${S3_BUCKET}/${S3_PREFIX}/${objek}" >/dev/null 2>&1 || {
      log "offsite: gagal menghapus ${objek}, dibiarkan."
      continue
    }
    jumlah=$((jumlah + 1))
  done <<<"$hapus"
  [[ "$jumlah" -eq 0 ]] || log "offsite: $jumlah salinan lama dihapus."
}

# Mengenkripsi arsip ke berkas baru, lalu menuliskan namanya ke stdout.
#
# GPG simetris dengan AES-256. Dipilih bukan karena paling canggih, melainkan
# karena paling mungkin masih dapat dibuka bertahun-tahun kemudian di mesin
# mana pun — dan itulah satu-satunya ukuran yang penting bagi backup.
#
# `--pinentry-mode loopback` wajib: tanpa itu gpg mencari terminal untuk
# menanyakan frasa sandi, dan cron tidak punya terminal.
enkripsi_arsip() {
  local sumber="$1" tujuan="${1}.gpg"

  printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet \
    --pinentry-mode loopback --passphrase-fd 0 \
    --symmetric --cipher-algo AES256 --digest-algo SHA512 \
    --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
    --compress-algo none \
    --output "$tujuan" "$sumber" ||
    die "enkripsi gagal untuk $(basename "$sumber"). Tidak ada yang diunggah."

  chmod 600 "$tujuan"
  printf '%s' "$tujuan"
}

# Membuktikan arsip terenkripsi benar-benar dapat dibuka kembali.
#
# Dijalankan setiap malam, sebelum unggahan. Enkripsi yang tidak pernah diuji
# hanya memindahkan kegagalan ke hari ketika backup itu benar-benar dibutuhkan —
# dan pada hari itu tidak ada kesempatan kedua.
uji_dekripsi() {
  local terenkripsi="$1" asli="$2" sha_asli sha_bulat

  sha_asli="$(sha256sum "$asli" | awk '{print $1}')"
  sha_bulat="$(printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --quiet \
    --pinentry-mode loopback --passphrase-fd 0 --decrypt "$terenkripsi" 2>/dev/null |
    sha256sum | awk '{print $1}')" || true

  [[ "$sha_asli" == "$sha_bulat" ]] ||
    die "arsip terenkripsi tidak dapat dibuka kembali menjadi berkas yang sama. Unggahan dibatalkan."
}

offsite_unggah() {
  local arsip="$1" nama ukuran_lokal ukuran_jauh sha_lokal sha_jauh
  local kirim="$arsip" sementara=""

  if ! offsite_dikonfigurasi; then
    log "offsite: tidak dikonfigurasi, unggahan dilewati. Salinan hanya ada di server ini."
    return 0
  fi

  # Dienkripsi sebelum keluar dari server, bukan sesudah sampai. Salinan lokal
  # sengaja dibiarkan apa adanya: kuncinya toh ada di server yang sama, jadi
  # mengenkripsinya di sini tidak menambah perlindungan dan hanya mempersulit
  # pemulihan pada saat paling genting.
  if [[ -n "$BACKUP_PASSPHRASE" ]]; then
    log "offsite: mengenkripsi arsip sebelum diunggah."
    sementara="$(enkripsi_arsip "$arsip")"
    uji_dekripsi "$sementara" "$arsip"
    kirim="$sementara"
    log "offsite: terenkripsi dan terbukti dapat dibuka kembali."
  else
    log "offsite: BACKUP_ENCRYPTION_PASSPHRASE kosong — arsip diunggah tanpa enkripsi."
  fi

  nama="$(basename "$kirim")"

  log "offsite: mengunggah ${nama} ke ${S3_BUCKET}/${S3_PREFIX}."
  rclone_jalan --mount "$(dirname "$kirim")" /arsip \
    copyto "/arsip/${nama}" "offsite:${S3_BUCKET}/${S3_PREFIX}/${nama}" \
    --s3-no-check-bucket --retries 3 --low-level-retries 5 >/dev/null 2>&1 ||
    die "unggahan offsite gagal untuk ${nama}. Checkpoint lokal tetap utuh di ${arsip}."

  ukuran_lokal="$(stat -c '%s' "$kirim")"
  ukuran_jauh="$(rclone_jalan size "offsite:${S3_BUCKET}/${S3_PREFIX}/${nama}" --json 2>/dev/null |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["bytes"])' 2>/dev/null || echo '')"
  [[ "$ukuran_jauh" == "$ukuran_lokal" ]] ||
    die "ukuran salinan offsite tidak cocok: lokal ${ukuran_lokal} byte, di ${S3_BUCKET} ${ukuran_jauh:-tidak terbaca} byte."

  if [[ "$OFFSITE_VERIFY" == "penuh" ]]; then
    # Diunduh kembali dan di-hash. Ukuran yang cocok hanya membuktikan sesuatu
    # sampai di sana, bukan bahwa isinya sama — dan backup yang tidak pernah
    # dibuktikan baru ketahuan rusak pada saat paling buruk.
    sha_lokal="$(sha256sum "$kirim" | awk '{print $1}')"
    sha_jauh="$(rclone_jalan cat "offsite:${S3_BUCKET}/${S3_PREFIX}/${nama}" 2>/dev/null |
      sha256sum | awk '{print $1}')"
    [[ "$sha_lokal" == "$sha_jauh" ]] ||
      die "sha256 salinan offsite berbeda dari berkas lokal untuk ${nama}."
    log "offsite: terverifikasi utuh (sha256 cocok, ${ukuran_lokal} byte)."
  else
    log "offsite: ukuran cocok (${ukuran_lokal} byte); verifikasi isi dilewati."
  fi

  # Salinan terenkripsi hanya kendaraan menuju penyimpanan objek; yang disimpan
  # di server tetap arsip aslinya.
  [[ -z "$sementara" ]] || rm -f "$sementara"

  offsite_pangkas
}

prune_all() {
  prune_bucket "$BACKUP_ROOT/daily" "$DAILY_KEEP"
  prune_bucket "$BACKUP_ROOT/weekly" "$WEEKLY_KEEP"
  prune_bucket "$BACKUP_ROOT/monthly" "$MONTHLY_KEEP"
}

mkdir -p "$BACKUP_ROOT"/{daily,weekly,monthly}
chmod 700 "$BACKUP_ROOT"

trap 'rm -f -- "$ALERT_FLAG"' EXIT

if [[ "${1:-}" == "--prune-only" ]]; then
  prune_all
  exit 0
fi

command -v docker >/dev/null || die "docker tidak tersedia."
[[ -n "$APP_UUID" ]] || die "LMS_APP_UUID belum diset; isi dengan UUID resource Coolify."

# Jalur peringatan harus dapat diuji tanpa merusak backup lebih dulu. Tanpa
# ini, satu-satunya cara membuktikan alarmnya menyala adalah menunggu backup
# benar-benar gagal.
if [[ "${1:-}" == "--test-alert" ]]; then
  alert "Uji peringatan backup LMS" \
    "Ini hanya uji jalur peringatan. Tidak ada backup yang gagal."
  exit 0
fi

# Membuktikan kredensial, jangkauan jaringan, dan izin tulis tanpa menunggu
# backup malam — dan tanpa mengotori keranjang dengan berkas yang menyerupai
# checkpoint sungguhan.
if [[ "${1:-}" == "--test-offsite" ]]; then
  offsite_dikonfigurasi || die "offsite belum dikonfigurasi: isi LMS_S3_ENDPOINT, LMS_S3_BUCKET, LMS_S3_ACCESS_KEY_ID, dan LMS_S3_SECRET_ACCESS_KEY."
  UJI_DIR="$(mktemp -d)"
  trap 'rm -rf -- "$UJI_DIR" "$ALERT_FLAG"' EXIT
  UJI_NAMA="uji-offsite-$(date -u '+%Y%m%dT%H%M%SZ').txt"
  printf 'Uji tulis dari %s pada %s\n' "$(hostname)" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >"$UJI_DIR/$UJI_NAMA"

  log "offsite: menguji tulis ke ${S3_BUCKET}/${S3_PREFIX}."
  rclone_jalan --mount "$UJI_DIR" /arsip \
    copyto "/arsip/${UJI_NAMA}" "offsite:${S3_BUCKET}/${S3_PREFIX}/${UJI_NAMA}" \
    --s3-no-check-bucket --retries 2 >/dev/null 2>&1 || die "uji tulis offsite gagal."

  UJI_ISI="$(rclone_jalan cat "offsite:${S3_BUCKET}/${S3_PREFIX}/${UJI_NAMA}" 2>/dev/null || true)"
  [[ "$UJI_ISI" == "$(cat "$UJI_DIR/$UJI_NAMA")" ]] || die "uji baca offsite tidak cocok dengan yang ditulis."

  rclone_jalan deletefile "offsite:${S3_BUCKET}/${S3_PREFIX}/${UJI_NAMA}" >/dev/null 2>&1 ||
    die "uji hapus offsite gagal; kredensial mungkin hanya berizin tulis."

  log "offsite: uji tulis, baca, dan hapus berhasil."

  # Jalur enkripsi ikut diuji di sini, memakai berkas kecil yang sama.
  #
  # Tanpa ini, satu-satunya bukti bahwa enkripsi berjalan adalah backup malam
  # hari yang berukuran belasan gigabyte — terlalu mahal untuk dijalankan
  # setiap kali seseorang mengubah skrip ini.
  if [[ -n "$BACKUP_PASSPHRASE" ]]; then
    log "enkripsi: menguji putaran enkripsi, unggah, unduh, dan dekripsi."
    UJI_SANDI="$(enkripsi_arsip "$UJI_DIR/$UJI_NAMA")"
    uji_dekripsi "$UJI_SANDI" "$UJI_DIR/$UJI_NAMA"

    rclone_jalan --mount "$UJI_DIR" /arsip \
      copyto "/arsip/$(basename "$UJI_SANDI")" "offsite:${S3_BUCKET}/${S3_PREFIX}/$(basename "$UJI_SANDI")" \
      --s3-no-check-bucket --retries 2 >/dev/null 2>&1 || die "uji unggah arsip terenkripsi gagal."

    # Diunduh kembali lalu didekripsi: yang harus terbukti bukan sekadar
    # "terenkripsi", melainkan "masih dapat dibuka setelah pulang-pergi".
    #
    # Ciphertext-nya ditulis ke berkas dulu, bukan disalurkan lewat pipe.
    # `--passphrase-fd 0` sudah memakai stdin untuk frasa sandi, jadi ciphertext
    # harus datang sebagai argumen berkas — memberi keduanya lewat stdin
    # membuat gpg mencoba mendekripsi frasa sandinya sendiri.
    rclone_jalan cat "offsite:${S3_BUCKET}/${S3_PREFIX}/$(basename "$UJI_SANDI")" \
      >"$UJI_DIR/pulang.gpg" 2>/dev/null || die "uji unduh arsip terenkripsi gagal."
    uji_dekripsi "$UJI_DIR/pulang.gpg" "$UJI_DIR/$UJI_NAMA"

    rclone_jalan deletefile "offsite:${S3_BUCKET}/${S3_PREFIX}/$(basename "$UJI_SANDI")" >/dev/null 2>&1 || true
    log "enkripsi: putaran penuh berhasil — terenkripsi, terunggah, terunduh, dan pulih utuh."
  else
    log "enkripsi: BACKUP_ENCRYPTION_PASSPHRASE kosong, jalur enkripsi tidak diuji."
  fi

  exit 0
fi

PG_CONTAINER="$(resolve_container "postgres-${APP_UUID}")"
STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK" "$ALERT_FLAG"' EXIT

log "mulai checkpoint $STAMP (postgres=$PG_CONTAINER)."

PG_USER="$(docker exec "$PG_CONTAINER" printenv POSTGRES_USER)"
PG_DB="$(docker exec "$PG_CONTAINER" printenv POSTGRES_DB)"
[[ -n "$PG_USER" && -n "$PG_DB" ]] || die "kredensial database tidak terbaca dari container."

# Format custom, bukan SQL polos: sudah terkompresi, mendukung restore
# selektif, dan `pg_restore --list` bisa membuktikan arsipnya tidak terpotong.
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" --format=custom --no-owner \
  >"$WORK/database.dump" || die "pg_dump tidak selesai."
[[ -s "$WORK/database.dump" ]] || die "dump database kosong."

docker exec -i "$PG_CONTAINER" pg_restore --list <"$WORK/database.dump" >/dev/null 2>&1 ||
  die "dump tidak dapat dibaca ulang oleh pg_restore; kemungkinan terpotong."

# Definisi role ikut disimpan. Tanpa ini restore ke instance baru menggugurkan
# setiap GRANT yang menunjuk role yang belum ada — drill pertama menghasilkan
# 43 galat semacam itu. Kata sandi sengaja tidak ikut: hash-nya tidak perlu
# ada di arsip yang mungkin dikirim ke luar server, dan kata sandi sebenarnya
# tetap tersedia dari environment variable Coolify saat restore.
docker exec "$PG_CONTAINER" pg_dumpall -U "$PG_USER" --globals-only --no-role-passwords \
  >"$WORK/globals.sql" || die "pg_dumpall globals gagal."

MIGRATION="$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc \
  "select migration_name from _prisma_migrations where finished_at is not null order by finished_at desc limit 1")"

{
  printf 'checkpoint: %s\n' "$STAMP"
  printf 'database: %s\n' "$PG_DB"
  printf 'migration_terakhir: %s\n' "${MIGRATION:-tidak diketahui}"
  printf 'pg_dump: %s\n' "$(docker exec "$PG_CONTAINER" pg_dump --version)"
  printf '\njumlah_baris:\n'
  for table in "${COUNTED_TABLES[@]}"; do
    count="$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc \
      "select count(*) from \"$table\"" 2>/dev/null || echo '?')"
    printf '  %s: %s\n' "$table" "$count"
  done
} >"$WORK/MANIFEST.txt"

# Volume diarsipkan lewat container helper supaya skrip tidak bergantung pada
# tata letak /var/lib/docker, yang berubah bila storage driver diganti.
for volume in "${VOLUMES[@]}"; do
  full="${APP_UUID}_${volume}"
  if ! docker volume inspect "$full" >/dev/null 2>&1; then
    log "volume $full tidak ada, dilewati."
    continue
  fi
  docker run --rm -v "$full":/src:ro -w /src alpine:3 tar czf - . \
    >"$WORK/${volume}.tar.gz" || die "arsip volume $full gagal."
done

# Checksum ditulis di luar $WORK dulu; kalau langsung ke dalamnya, file
# checksum yang masih kosong ikut terhitung oleh globnya sendiri.
SUMS="$(mktemp)"
(cd "$WORK" && sha256sum ./*) >"$SUMS"
mv "$SUMS" "$WORK/SHA256SUMS"

# Ditulis ke nama sementara lalu dipindah, supaya checkpoint yang terpotong
# karena server mati di tengah proses tidak pernah terlihat seperti backup sah.
ARCHIVE="$BACKUP_ROOT/daily/lms-${STAMP}.tar"
tar cf "$ARCHIVE.partial" -C "$WORK" . || die "pengemasan checkpoint gagal."
chmod 600 "$ARCHIVE.partial"
mv "$ARCHIVE.partial" "$ARCHIVE"

# Weekly dan monthly memakai hardlink, jadi retensi panjang tidak memakan
# ruang tambahan sampai salinan harian yang sama dipangkas. Ditulis sebagai
# `if` penuh, bukan `[[ ... ]] && ...`: dengan `set -e`, bentuk ringkas itu
# menghentikan skrip pada hari yang kondisinya tidak terpenuhi.
if [[ "$(date -u '+%u')" == "7" ]]; then
  ln -f "$ARCHIVE" "$BACKUP_ROOT/weekly/lms-${STAMP}.tar"
fi
if [[ "$(date -u '+%d')" == "01" ]]; then
  ln -f "$ARCHIVE" "$BACKUP_ROOT/monthly/lms-${STAMP}.tar"
fi

prune_all

# Diunggah setelah checkpoint lokal utuh dan terpangkas. Urutan ini penting:
# kalau unggahannya gagal, yang di server tetap ada dan sah — kegagalannya
# hanya soal salinan kedua, dan itulah yang dikatakan pesan peringatannya.
offsite_unggah "$ARCHIVE"

log "selesai: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1)), migrasi ${MIGRATION:-?}."
