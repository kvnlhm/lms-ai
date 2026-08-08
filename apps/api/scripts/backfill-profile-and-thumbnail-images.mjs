/**
 * Mengolah ulang thumbnail kursus dan foto profil yang tersimpan sebelum
 * pengolahan saat unggah ada.
 *
 * Berbeda dari lampiran komunitas, keduanya tidak punya kolom kunci objek:
 * yang menunjuk berkasnya adalah kolom URL (`courses.thumbnail_url`,
 * `users.avatar_url`). Karena itu berkas baru ditulis lebih dulu, URL-nya
 * diarahkan ke sana, dan yang lama baru dibuang.
 *
 * Aman diulang: yang sudah `.webp` dilewati, jadi proses yang terhenti di
 * tengah tinggal dijalankan lagi.
 *
 *   node scripts/backfill-profile-and-thumbnail-images.mjs [--dry-run]
 *
 * Butuh DATABASE_URL, COURSE_THUMBNAIL_STORAGE_PATH, dan AVATAR_STORAGE_PATH.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { rename, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp from 'sharp';

const kering = process.argv.includes('--dry-run');
const prisma = new PrismaClient();
const rapi = (bytes) => `${(Number(bytes) / 1048576).toFixed(2)} MB`;

/** Sama dengan `SISI_MAKS` pada masing-masing service. */
const TUGAS = [
  {
    nama: 'thumbnail kursus',
    sisiMaks: 1200,
    storage: process.env.COURSE_THUMBNAIL_STORAGE_PATH ?? '/data/course-thumbnails',
    prefixUrl: '/api/v1/courses/thumbnails/',
    async antre() {
      const rows = await prisma.course.findMany({
        where: { thumbnailUrl: { not: null } },
        select: { id: true, thumbnailUrl: true },
      });
      return rows.map((row) => ({ id: row.id, url: row.thumbnailUrl }));
    },
    simpan: (id, thumbnailUrl) => prisma.course.update({ where: { id }, data: { thumbnailUrl } }),
  },
  {
    nama: 'foto profil',
    sisiMaks: 256,
    storage: process.env.AVATAR_STORAGE_PATH ?? '/data/avatars',
    prefixUrl: '/api/v1/auth/avatars/',
    async antre() {
      const rows = await prisma.user.findMany({
        where: { avatarUrl: { not: null } },
        select: { id: true, avatarUrl: true },
      });
      return rows.map((row) => ({ id: row.id, url: row.avatarUrl }));
    },
    simpan: (id, avatarUrl) => prisma.user.update({ where: { id }, data: { avatarUrl } }),
  },
];

async function jalankan(tugas) {
  const semua = await tugas.antre();
  // Yang sudah `.webp` sudah diolah — inilah yang membuat skrip ini aman
  // dijalankan berulang kali.
  const antre = semua.filter((baris) => !baris.url.endsWith('.webp'));
  console.log(`\n${tugas.nama}: ${antre.length} dari ${semua.length} perlu diolah di ${tugas.storage}${kering ? ' (dry-run)' : ''}`);

  let berhasil = 0, dilewati = 0, sebelum = 0, sesudah = 0;
  for (const baris of antre) {
    const namaLama = basename(baris.url);
    const lama = join(tugas.storage, namaLama);
    // Nama mempertahankan id pemiliknya di depan, seperti yang ditulis service,
    // supaya pola berkasnya tetap dapat dikenali `open()` dan penyapu.
    const namaBaru = `${baris.id}-${randomUUID()}.webp`;
    const sementara = join(tugas.storage, `${namaBaru}.uploading`);
    const baru = join(tugas.storage, namaBaru);
    try {
      const asal = (await stat(lama)).size;
      await sharp(lama)
        .autoOrient()
        .resize({ width: tugas.sisiMaks, height: tugas.sisiMaks, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(sementara);
      const ukuran = (await stat(sementara)).size;

      if (kering) {
        await rm(sementara, { force: true });
      } else {
        await rename(sementara, baru);
        await tugas.simpan(baris.id, `${tugas.prefixUrl}${namaBaru}`);
        await rm(lama, { force: true });
      }

      sebelum += asal; sesudah += ukuran; berhasil += 1;
      console.log(`  ${namaLama} → ${namaBaru}  ${rapi(asal)} → ${rapi(ukuran)}`);
    } catch (error) {
      await rm(sementara, { force: true });
      dilewati += 1;
      console.warn(`  LEWAT ${namaLama}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`${tugas.nama} selesai: ${berhasil} diolah, ${dilewati} dilewati, ${rapi(sebelum)} → ${rapi(sesudah)}`);
}

async function main() {
  for (const tugas of TUGAS) await jalankan(tugas);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
