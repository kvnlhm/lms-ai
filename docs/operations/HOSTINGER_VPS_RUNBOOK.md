# Hostinger VPS Deployment Runbook

## Prerequisites

- Ubuntu 24.04 dengan Docker Engine dan Docker Compose plugin.
- Domain memiliki A record ke IPv4 VPS.
- SSH memakai key; jangan kirim private key atau password melalui chat.
- Hostinger firewall dan UFW hanya membuka SSH dari IP admin, TCP 80, dan
  TCP 443. PostgreSQL, Redis, API, web, worker, dan AI tidak memiliki public
  port pada Compose production.
- Minimal 4 GB RAM untuk seluruh stack awal. Tambahkan swap sebagai safety net,
  tetapi jangan menganggap swap sebagai pengganti RAM.
- Lokasi backup terenkripsi di luar VPS sudah ditentukan.

Hostinger menyediakan template Ubuntu 24.04 dengan Docker dan Compose
pre-installed. Mengganti template OS menghapus isi VPS, jadi gunakan VPS kosong
atau backup lebih dahulu.

## 1. Prepare Server

```bash
ssh <admin-user>@<vps-ip>
sudo mkdir -p /opt/lms
sudo chown "$USER":"$USER" /opt/lms
cd /opt/lms
git clone <repository-url> .
cp .env.production.example .env.production
chmod 600 .env.production
```

Isi `.env.production` langsung di VPS. Buat nilai acak:

```bash
openssl rand -base64 36
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Password pada `DATABASE_URL` dan `REDIS_URL` harus URL-encoded. Jangan commit
`.env.production`.

## 2. DNS and Firewall

Sebelum meminta sertifikat:

```bash
dig +short <domain>
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Di hPanel Hostinger, aktifkan firewall group dengan rule SSH, HTTP, dan HTTPS.
Batasi SSH ke IP admin bila IP tersebut stabil.

## 3. Obtain TLS Certificate

Nginx belum boleh berjalan pada tahap ini karena Certbot memakai port 80:

```bash
ENV_FILE=.env.production docker compose \
  -f docker-compose.production.yml \
  --env-file .env.production \
  --profile ops run --rm --service-ports certbot \
  certonly --standalone --non-interactive --agree-tos \
  --email <ops-email> -d <domain>
```

## 4. Deploy

```bash
ENV_FILE=.env.production docker compose \
  -f docker-compose.production.yml \
  --env-file .env.production \
  build

ENV_FILE=.env.production docker compose \
  -f docker-compose.production.yml \
  --env-file .env.production \
  up -d

ENV_FILE=.env.production docker compose \
  -f docker-compose.production.yml \
  --env-file .env.production \
  ps
```

Jangan menjalankan seed lokal pada production. Setelah migration sukses dan
sebelum pengguna lain dibuat, bootstrap Master pertama:

```bash
read -r -p "Email Master: " BOOTSTRAP_MASTER_EMAIL
read -r -p "Nama Master: " BOOTSTRAP_MASTER_NAME
read -r -s -p "Password Master: " BOOTSTRAP_MASTER_PASSWORD
export BOOTSTRAP_MASTER_EMAIL BOOTSTRAP_MASTER_NAME BOOTSTRAP_MASTER_PASSWORD
ENV_FILE=.env.production docker compose -f docker-compose.production.yml \
  --env-file .env.production run --rm \
  -e BOOTSTRAP_MASTER_EMAIL -e BOOTSTRAP_MASTER_NAME -e BOOTSTRAP_MASTER_PASSWORD \
  api pnpm --filter @lms/api db:bootstrap-master
unset BOOTSTRAP_MASTER_EMAIL BOOTSTRAP_MASTER_NAME BOOTSTRAP_MASTER_PASSWORD
```

Perintah menolak berjalan jika sudah ada pengguna. Login lalu aktifkan MFA
sebelum go-live.

## 5. Verify

```bash
curl --fail --silent --show-error https://<domain>/api/v1/health/live
curl --fail --silent --show-error https://<domain>/api/v1/health/ready
curl --fail --silent --show-error https://<domain>/api/health
```

Business smoke test:

1. Login Master dan selesaikan MFA.
2. Buat draft course dan lesson VIDEO.
3. Upload MP4 H.264/AAC kecil.
4. Enroll test student.
5. Login student dan pastikan video bisa diputar serta seek (HTTP Range).
6. Pastikan student tanpa enrollment mendapat 404/403 sesuai contract.
7. Pastikan URL `/protected-videos/<object>` tidak dapat dibuka langsung.

## 6. Certificate Renewal

Jalankan lewat cron/systemd timer saat Nginx dihentikan singkat, lalu nyalakan
kembali. Jadwalkan ketika traffic rendah dan uji dahulu:

```bash
ENV_FILE=.env.production docker compose -f docker-compose.production.yml stop nginx
ENV_FILE=.env.production docker compose -f docker-compose.production.yml \
  --env-file .env.production --profile ops run --rm --service-ports certbot renew
ENV_FILE=.env.production docker compose -f docker-compose.production.yml start nginx
```

## 7. Backup Gate

Sebelum menerima pengguna nyata:

- `pg_dump` harian dan video volume harus dienkripsi;
- salinan dikirim ke storage di luar VPS;
- retention ditetapkan;
- restore database dan satu video sample diuji;
- snapshot Hostinger bukan satu-satunya backup;
- alert disk dipasang pada 70% dan 85%.

## 8. Rollback

- Simpan image/tag Git release sebelumnya.
- Migration harus backward-compatible.
- Rollback aplikasi dengan checkout release sebelumnya lalu build/up.
- Jangan menghapus volume dengan `down -v`.
- Jika data rusak, freeze mutation dan ikuti `BACKUP_RESTORE.md`.
