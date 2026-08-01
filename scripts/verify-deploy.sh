#!/usr/bin/env bash
#
# Verifikasi setelah deploy produksi.
#
# Coolify melaporkan "finished" begitu `docker compose up` selesai. Itu tidak
# sama dengan "deploy berhasil": pada 31 Juli 2026 statusnya sempat finished
# sementara container API crash-loop dan situs membalas 503.
#
# Skrip ini memeriksa yang benar-benar menentukan, dan hanya membaca — tidak
# mengubah apa pun dan tidak mengirim surat. Keluar dengan kode 1 bila ada yang
# tidak beres, sehingga dapat dipakai sebagai gerbang sebelum menyatakan
# deploy selesai.
set -Eeuo pipefail

APP_UUID="${LMS_APP_UUID:-}"
SITE="${LMS_SITE_URL:-https://academy.aipreneur.co.id}"
REPO="${LMS_REPO_DIR:-/root/lms-ai}"

SERVICES=(gateway web api worker postgres redis)

merah=0
ok()    { printf '  ✓ %s\n' "$*"; }
# %b, bukan %s: sebagian pesan memuat baris baru untuk merinci temuannya, dan
# dengan %s penanda barunya tercetak mentah sebagai "\n".
gagal() { printf '  ✗ %b\n' "$*"; merah=1; }

[[ -n "$APP_UUID" ]] || { echo "LMS_APP_UUID belum diset." >&2; exit 2; }

# Nama container Coolify punya dua bentuk: dengan akhiran waktu deploy
# (`gateway-UUID-1234567890`) dan tanpa akhiran (`gateway-UUID`) sejak
# "consistent container name" dinyalakan. Pola di bawah menerima keduanya —
# mencari `UUID-` saja akan berhenti menemukan apa pun setelah pergantian itu,
# dan gejalanya adalah laporan "semua container mati" pada sistem yang sehat.
resolve() { docker ps --format '{{.Names}}' | grep -E "^${1}-${APP_UUID}(-|\$)" | head -1 || true; }

echo "1. Container"
for service in "${SERVICES[@]}"; do
  line="$(docker ps -a --filter "name=^${service}-${APP_UUID}(-|\$)" --format '{{.State}}|{{.Status}}' | head -1 || true)"
  if [[ -z "$line" ]]; then
    gagal "${service}: tidak ada containernya"
  elif [[ "${line%%|*}" != "running" ]]; then
    gagal "${service}: ${line}"
  elif [[ "$line" == *"unhealthy"* ]]; then
    # `unhealthy` tetap berstatus running; tanpa diperiksa khusus ia lolos.
    gagal "${service}: berjalan tetapi unhealthy"
  else
    ok "${service}: ${line#*|}"
  fi
done

echo "2. Situs dan health check"
kode="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 25 "${SITE}/" || echo 000)"
[[ "$kode" == "200" ]] && ok "halaman utama membalas 200" || gagal "halaman utama membalas ${kode}"

ready="$(curl -s --max-time 25 "${SITE}/api/v1/health/ready" || true)"
if grep -q '"database":true' <<<"$ready" && grep -q '"redis":true' <<<"$ready"; then
  ok "health/ready: database dan redis terhubung"
else
  gagal "health/ready tidak sehat: ${ready:-tidak ada balasan}"
fi

echo "3. Migrasi"
pg="$(resolve postgres)"
if [[ -z "$pg" ]]; then
  gagal "container postgres tidak ditemukan, migrasi tidak dapat diperiksa"
else
  terpasang="$(docker exec "$pg" psql -U lms -d lms -tAc \
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL" 2>/dev/null | sort || true)"
  direpo="$(ls -1 "$REPO/apps/api/prisma/migrations" 2>/dev/null | grep -v migration_lock | sort || true)"

  # Yang dicari: migrasi yang ada di repo tetapi belum terpasang. Kebalikannya
  # wajar — produksi boleh memuat migrasi dari commit yang lebih baru.
  belum="$(comm -23 <(printf '%s\n' "$direpo") <(printf '%s\n' "$terpasang") || true)"
  if [[ -z "$belum" ]]; then
    ok "seluruh $(wc -l <<<"$direpo") migrasi repo sudah terpasang"
  else
    gagal "migrasi belum terpasang:\n$(sed 's/^/      /' <<<"$belum")"
  fi
fi

echo "4. Galat runtime sejak deploy"
api="$(resolve api)"
if [[ -n "$pg" ]]; then
  # Container API yang baru menandai kapan deploy selesai; galat yang tercatat
  # setelahnya adalah galat milik versi ini, bukan warisan versi sebelumnya.
  sejak="$(docker inspect -f '{{.State.StartedAt}}' "$api" 2>/dev/null || echo '1970-01-01T00:00:00Z')"
  jumlah="$(docker exec "$pg" psql -U lms -d lms -tAc \
    "SELECT count(*) FROM error_events WHERE last_seen_at >= '${sejak}'" 2>/dev/null | tr -d ' ' || echo '?')"
  if [[ "$jumlah" == "0" ]]; then
    ok "tidak ada galat tercatat sejak API menyala"
  else
    # Belum tentu gagal: bisa jadi galat lama yang terulang. Perlu dilihat,
    # bukan otomatis menggagalkan.
    printf '  ! %s galat tercatat sejak deploy — periksa /master/errors\n' "$jumlah"
  fi
fi

echo
if [[ $merah -eq 0 ]]; then
  echo "Deploy terverifikasi."
else
  echo "Deploy BERMASALAH. Jangan tinggalkan dalam keadaan ini." >&2
fi
exit $merah
