#!/usr/bin/env bash
# Restore drill terhadap checkpoint terbaru.
#
# Drill 1 Agustus sudah membuktikan databasenya dapat dipulihkan dan jumlah
# barisnya cocok. Dua hal yang saat itu dicatat sebagai "masih menunggu" belum
# pernah dikerjakan, dan keduanya ada di sini:
#   - memulihkan volume unggahan, bukan hanya database;
#   - memeriksa data hasil restore sungguhan, bukan hanya menghitung barisnya.
#
# Produksi tidak disentuh sama sekali: seluruhnya berjalan di container dan
# volume terpisah yang dibuang di akhir.
set -uo pipefail

# Tanpa argumen: checkpoint harian terbaru. BACKUP_RESTORE.md §6 menuntut drill
# minimal tiap tiga bulan, dan drill yang menuntut orang mengetik nama arsip
# adalah drill yang tidak dijalankan.
ARSIP="${1:-$(ls -1t /var/backups/lms-ai/daily/lms-*.tar 2>/dev/null | head -1)}"
[[ -f "${ARSIP:-}" ]] || { echo "Arsip checkpoint tidak ditemukan." >&2; exit 2; }
KERJA="/var/tmp/drill-$(date -u +%Y%m%dT%H%M%SZ)"
PG="drill-pg"
LOG="$KERJA/drill.log"

lulus=0; gagal=0
catat() { printf '%s %s\n' "$(date -u '+%H:%M:%S')" "$*" | tee -a "$LOG"; }
nilai() {
  if [[ "$2" == "$3" ]]; then printf '  LULUS  %-42s %s\n' "$1" "$2" | tee -a "$LOG"; lulus=$((lulus+1));
  else printf '  GAGAL  %-42s harap %s, dapat %s\n' "$1" "$3" "$2" | tee -a "$LOG"; gagal=$((gagal+1)); fi
}

bersih() {
  docker rm -f "$PG" >/dev/null 2>&1
  for v in video-data avatar-data course-thumbnail-data material-data; do
    docker volume rm "drill-$v" >/dev/null 2>&1
  done
  rm -rf "$KERJA"
}
trap bersih EXIT

mkdir -p "$KERJA"
catat "arsip: $ARSIP ($(du -h "$ARSIP" | cut -f1))"

catat "membongkar arsip"
tar xf "$ARSIP" -C "$KERJA" || { catat "GAGAL membongkar"; exit 1; }
ls -la "$KERJA" >>"$LOG"

catat "memeriksa SHA256SUMS"
if (cd "$KERJA" && sha256sum -c SHA256SUMS >/dev/null 2>&1); then
  nilai "checksum seluruh berkas arsip" "cocok" "cocok"
else
  nilai "checksum seluruh berkas arsip" "tidak cocok" "cocok"
fi

catat "menyalakan PostgreSQL 16 terpisah"
docker run -d --name "$PG" -e POSTGRES_PASSWORD=drill -e POSTGRES_USER=drill \
  -e POSTGRES_DB=drill postgres:16-alpine >/dev/null || { catat "GAGAL menyalakan"; exit 1; }
for _ in $(seq 1 60); do
  docker exec "$PG" pg_isready -U drill >/dev/null 2>&1 && break
  sleep 2
done

catat "memulihkan definisi role"
docker exec -i "$PG" psql -U drill -d postgres <"$KERJA/globals.sql" >>"$LOG" 2>&1
catat "memulihkan database"
docker exec -i "$PG" psql -U drill -d postgres -c 'create database pulih' >>"$LOG" 2>&1
docker exec -i "$PG" pg_restore -U drill -d pulih --no-owner --no-privileges \
  <"$KERJA/database.dump" >>"$LOG" 2>&1
catat "restore selesai (galat non-fatal tercatat di log)"

hitung() { docker exec "$PG" psql -U drill -d pulih -tAc "select count(*) from \"$1\"" 2>/dev/null | tr -d ' '; }

catat "membandingkan jumlah baris dengan MANIFEST.txt"
while read -r tabel harap; do
  [[ -z "$tabel" ]] && continue
  nilai "baris $tabel" "$(hitung "$tabel")" "$harap"
done < <(sed -n '/^jumlah_baris:/,$p' "$KERJA/MANIFEST.txt" | tail -n +2 | sed 's/://' | awk '{print $1, $2}')

catat "memeriksa isi, bukan hanya jumlahnya"
# Pembandingnya migrasi terakhir yang tercatat di MANIFEST, bukan jumlah folder
# migrasi di repo hari ini. Repo terus bergerak; arsip tidak. Percobaan pertama
# membandingkan keduanya dan menuduh arsip kurang satu migrasi, padahal yang
# bertambah adalah repo, sesudah arsipnya dibuat.
migrasi="$(docker exec "$PG" psql -U drill -d pulih -tAc \
  "select count(*) from _prisma_migrations where finished_at is not null" | tr -d ' ')"
terakhir="$(docker exec "$PG" psql -U drill -d pulih -tAc \
  "select migration_name from _prisma_migrations where finished_at is not null
   order by finished_at desc limit 1" | tr -d ' ')"
harap_terakhir="$(awk '/^migration_terakhir:/ {print $2}' "$KERJA/MANIFEST.txt")"
catat "migrasi tercatat selesai: $migrasi"
nilai "migrasi terakhir sama dengan MANIFEST" "$terakhir" "$harap_terakhir"

# Pertanyaan yang benar-benar ditanyakan produksi setiap hari: apakah pelajar
# yang membayar masih punya akses ke kursus yang terbit? Jumlah baris tidak
# menjawab itu; relasinya yang menjawab.
tertaut="$(docker exec "$PG" psql -U drill -d pulih -tAc \
  "select count(*) from enrollments e join users u on u.id = e.user_id
   join courses c on c.id = e.course_id where e.status = 'ACTIVE'" | tr -d ' ')"
catat "enrollment ACTIVE yang relasinya utuh ke user dan course: $tertaut"
[[ "${tertaut:-0}" -gt 0 ]] && { nilai "relasi enrollment utuh" "ada" "ada"; } || { nilai "relasi enrollment utuh" "kosong" "ada"; }

catat "memulihkan volume unggahan"
for v in video-data avatar-data course-thumbnail-data material-data; do
  berkas="$KERJA/${v}.tar.gz"
  if [[ ! -f "$berkas" ]]; then catat "  $v: tidak ada di arsip"; continue; fi
  docker volume create "drill-$v" >/dev/null
  if docker run --rm -i -v "drill-$v":/dst -w /dst alpine:3 tar xzf - <"$berkas" >>"$LOG" 2>&1; then
    jml="$(docker run --rm -v "drill-$v":/d alpine:3 sh -c 'find /d -type f | wc -l' | tr -d ' ')"
    ukur="$(docker run --rm -v "drill-$v":/d alpine:3 sh -c 'du -sh /d | cut -f1')"
    catat "  $v: $jml berkas, $ukur"
    [[ "$jml" -gt 0 ]] && lulus=$((lulus+1)) || catat "  $v kosong setelah dipulihkan"
  else
    catat "  $v: GAGAL dipulihkan"; gagal=$((gagal+1))
  fi
done

# Bukti terakhir, dan yang paling jarang diperiksa: berkas hasil restore benar
# adanya, bukan sekadar ada namanya. Header PNG/JPEG dibaca langsung.
catat "membuka satu berkas contoh dari volume yang dipulihkan"
contoh="$(docker run --rm -v drill-course-thumbnail-data:/d alpine:3 \
  sh -c 'find /d -type f | head -1' 2>/dev/null)"
if [[ -n "$contoh" ]]; then
  jenis="$(docker run --rm -v drill-course-thumbnail-data:/d alpine:3 \
    sh -c "head -c 8 '$contoh' | od -An -tx1 | tr -d ' \n'")"
  catat "  $contoh → $jenis"
  # Thumbnail disimpan sebagai WebP, bukan PNG. Percobaan pertama hanya
  # mengenali PNG dan JPEG, lalu menyatakan berkas yang sepenuhnya sah sebagai
  # "tidak dikenali" — kegagalan pada alat ukurnya, bukan pada cadangannya.
  case "$jenis" in
    89504e470d0a1a0a*) nilai "berkas contoh terbaca sebagai gambar" "gambar" "gambar"; catat "  (PNG)" ;;
    ffd8ff*)           nilai "berkas contoh terbaca sebagai gambar" "gambar" "gambar"; catat "  (JPEG)" ;;
    52494646*)         nilai "berkas contoh terbaca sebagai gambar" "gambar" "gambar"; catat "  (RIFF/WebP)" ;;
    *)                 nilai "berkas contoh terbaca sebagai gambar" "tidak dikenali" "gambar" ;;
  esac
else
  catat "  tidak ada berkas thumbnail di arsip"
fi

catat "RINGKASAN: $lulus lulus, $gagal gagal"
cp "$LOG" "${LMS_DRILL_LOG:-/var/backups/lms-ai/restore-drill-terakhir.log}"
[[ "$gagal" -eq 0 ]]
