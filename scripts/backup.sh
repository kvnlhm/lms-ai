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
# Pemakaian:
#   backup.sh              # ambil checkpoint lalu pangkas yang kedaluwarsa
#   backup.sh --prune-only # hanya pangkas
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

VOLUMES=(video-data avatar-data course-thumbnail-data)
COUNTED_TABLES=(users enrollments lesson_progress registration_orders video_assets forum_topics)

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE" >&2
}

die() {
  log "GAGAL: $*"
  exit 1
}

# Nama container berubah setiap deploy Coolify, jadi selalu diselesaikan lewat
# prefiks. Kalau hasilnya bukan tepat satu, lebih baik berhenti daripada
# membackup container yang salah.
resolve_container() {
  local prefix="$1" matches
  matches="$(docker ps --format '{{.Names}}' | grep "^${prefix}" || true)"
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
  done < <(ls -1 "$dir" 2>/dev/null | grep -E '^lms-[0-9]{8}T[0-9]{6}Z\.tar$' | sort -r | tail -n "+$((keep + 1))")
  [[ "$removed" -eq 0 ]] || log "pangkas $(basename "$dir"): $removed checkpoint dihapus."
}

prune_all() {
  prune_bucket "$BACKUP_ROOT/daily" "$DAILY_KEEP"
  prune_bucket "$BACKUP_ROOT/weekly" "$WEEKLY_KEEP"
  prune_bucket "$BACKUP_ROOT/monthly" "$MONTHLY_KEEP"
}

mkdir -p "$BACKUP_ROOT"/{daily,weekly,monthly}
chmod 700 "$BACKUP_ROOT"

if [[ "${1:-}" == "--prune-only" ]]; then
  prune_all
  exit 0
fi

command -v docker >/dev/null || die "docker tidak tersedia."
[[ -n "$APP_UUID" ]] || die "LMS_APP_UUID belum diset; isi dengan UUID resource Coolify."

PG_CONTAINER="$(resolve_container "postgres-${APP_UUID}-")"
STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT

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

log "selesai: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1)), migrasi ${MIGRATION:-?}."
