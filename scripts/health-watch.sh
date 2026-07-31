#!/usr/bin/env bash
#
# Pengawas kesehatan container dan situs.
#
# Coolify punya saklar "container status change" di antarmukanya, dan saklar itu
# menyala. Tetapi pada Coolify 4.1.2 pemanggilan notifikasinya **dikomentari di
# source**: `app/Actions/Docker/GetContainersStatus.php` baris 362 dan 450 berisi
#   // $this->server->team?->notify(new ContainerStopped(...));
# Tidak ada satu pun pemanggilan aktif untuk container aplikasi. Saklarnya mati
# secara diam-diam, dan itu baru ketahuan setelah produksi mati sembilan menit
# tanpa satu pun surat container.
#
# Yang tetap bekerja di Coolify: peringatan deployment gagal, disk, dan server
# tidak terjangkau. Yang tidak: container aplikasi yang mati atau crash-loop di
# luar proses deploy — persis skenario jam tiga pagi yang paling membutuhkannya.
#
# Skrip ini menutup lubang itu. Dijalankan berkala oleh cron.
set -Eeuo pipefail

APP_UUID="${LMS_APP_UUID:-}"
ALERT_TO="${LMS_ALERT_TO:-}"
ALERT_FROM="${LMS_ALERT_FROM:-AIPreneur Academy Alerts <alerts@send.aipreneur.co.id>}"
SITE_URL="${LMS_SITE_URL:-https://academy.aipreneur.co.id/api/v1/health/ready}"
STATE_DIR="${LMS_WATCH_STATE_DIR:-/var/lib/lms-health-watch}"
LOG_FILE="${LMS_WATCH_LOG:-/var/log/lms-health-watch.log}"

# Layanan yang wajib berjalan. Nama container berubah setiap deploy, jadi selalu
# dicocokkan lewat prefiks `<layanan>-<uuid>-`.
SERVICES=(gateway web api worker postgres redis)

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE" >&2
}

[[ -n "$APP_UUID" ]] || { log "LMS_APP_UUID belum diset."; exit 2; }
mkdir -p "$STATE_DIR"

resend_key() {
  local api
  api="$(docker ps --format '{{.Names}}' | grep "^api-${APP_UUID}-" | head -1 || true)"
  # Justru ketika API-nya mati kunci ini paling dibutuhkan, jadi ada cadangan:
  # container API mana pun, lalu berkas cadangan yang ditulis saat sehat.
  [[ -n "$api" ]] || api="$(docker ps --format '{{.Names}}' | grep '^api-' | head -1 || true)"
  if [[ -n "$api" ]]; then
    local key
    key="$(docker exec "$api" printenv RESEND_API_KEY 2>/dev/null | tr -d '\r\n' || true)"
    if [[ -n "$key" ]]; then
      # Disimpan supaya siklus berikutnya tetap dapat mengirim surat walau
      # seluruh container API sudah mati. Tanpa ini, pengawas justru bisu
      # tepat pada kegagalan terparah.
      printf '%s' "$key" >"$STATE_DIR/resend.key"
      chmod 600 "$STATE_DIR/resend.key"
      printf '%s' "$key"
      return 0
    fi
  fi
  [[ -r "$STATE_DIR/resend.key" ]] && cat "$STATE_DIR/resend.key"
}

send_mail() {
  local subject="$1" detail="$2" key payload
  [[ -n "$ALERT_TO" ]] || { log "surat tidak dikirim: LMS_ALERT_TO belum diset."; return 0; }
  key="$(resend_key || true)"
  [[ -n "$key" ]] || { log "surat tidak dikirim: kunci Resend tidak terbaca."; return 0; }

  payload="$(
    SUBJ="$subject" DETAIL="$detail" TO="$ALERT_TO" FROM="$ALERT_FROM" \
    HOST="$(hostname)" STAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    python3 - <<'PY'
import html, json, os
subject = os.environ["SUBJ"]
body = (
    f"<p><strong>{html.escape(subject)}</strong></p>"
    f"<p>Server: {html.escape(os.environ['HOST'])}<br>Waktu: {os.environ['STAMP']}</p>"
    f"<pre>{html.escape(os.environ['DETAIL'])}</pre>"
)
print(json.dumps({
    "from": os.environ["FROM"],
    "to": [os.environ["TO"]],
    "subject": subject,
    "html": body,
}))
PY
  )"

  curl -sS -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer ${key}" \
    -H 'Content-Type: application/json' \
    -d "$payload" >/dev/null || log "pengiriman surat gagal."
}

# Memeriksa satu layanan. Mengembalikan keterangan kosong bila sehat.
check_service() {
  local service="$1" line name status health
  line="$(docker ps -a --filter "name=^${service}-${APP_UUID}-" --format '{{.Names}}|{{.State}}|{{.Status}}' | head -1 || true)"

  if [[ -z "$line" ]]; then
    printf '%s: tidak ada containernya sama sekali' "$service"
    return
  fi

  name="${line%%|*}"
  status="${line#*|}"
  state="${status%%|*}"
  health="${status#*|}"

  if [[ "$state" != "running" ]]; then
    printf '%s: %s (%s)' "$service" "$state" "$health"
    return
  fi
  # `unhealthy` tetap berstatus running; tanpa memeriksanya, container yang
  # gagal seluruh health check-nya akan terhitung sehat.
  if [[ "$health" == *"unhealthy"* ]]; then
    printf '%s: berjalan tetapi unhealthy (%s)' "$service" "$health"
    return
  fi
}

masalah=()
for service in "${SERVICES[@]}"; do
  hasil="$(check_service "$service")"
  [[ -z "$hasil" ]] || masalah+=("$hasil")
done

# Situs diperiksa dari luar juga: seluruh container dapat terlihat sehat
# sementara gateway salah merutekan dan pengunjung tetap menerima 502.
kode="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL" || echo 000)"
[[ "$kode" == "200" ]] || masalah+=("situs: ${SITE_URL} membalas ${kode}")

STATE_FILE="$STATE_DIR/status"
sebelumnya="$(cat "$STATE_FILE" 2>/dev/null || echo sehat)"

if [[ ${#masalah[@]} -gt 0 ]]; then
  detail="$(printf '%s\n' "${masalah[@]}")"
  log "TIDAK SEHAT: ${detail//$'\n'/; }"
  # Surat hanya dikirim pada perpindahan keadaan. Mengirim tiap siklus akan
  # membuat satu insiden menghasilkan puluhan surat dan berhenti dibaca.
  if [[ "$sebelumnya" == "sehat" ]]; then
    send_mail "Produksi LMS tidak sehat" "$detail"
  fi
  printf 'tidak-sehat' >"$STATE_FILE"
  exit 1
fi

log "sehat: seluruh layanan berjalan dan situs membalas 200."
if [[ "$sebelumnya" != "sehat" ]]; then
  # Pemulihan ikut dikabarkan; tanpa itu penerimanya tidak pernah tahu apakah
  # masalahnya sudah selesai atau masih berlangsung.
  send_mail "Produksi LMS pulih" "Seluruh layanan berjalan kembali dan situs membalas 200."
fi
printf 'sehat' >"$STATE_FILE"
