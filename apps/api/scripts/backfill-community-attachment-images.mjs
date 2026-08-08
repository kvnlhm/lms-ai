/**
 * Mengolah ulang gambar lampiran komunitas yang tersimpan sebelum pengolahan
 * saat unggah ada.
 *
 * Berkas-berkas itu adalah keluaran kamera apa adanya — beberapa megabyte,
 * ribuan piksel — dan setiap pembaca postingannya mengunduhnya utuh untuk
 * ditampilkan pada kartu selebar beberapa ratus piksel. Yang baru sudah
 * dikecilkan saat masuk; yang lama hanya dapat dikejar dari sini.
 *
 * Aman diulang: baris yang sudah punya `width` dilewati, jadi proses yang
 * terhenti di tengah tinggal dijalankan lagi.
 *
 *   node scripts/backfill-community-attachment-images.mjs [--dry-run]
 *
 * Butuh DATABASE_URL dan COMMUNITY_ATTACHMENT_STORAGE_PATH, sama seperti API.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** Sama dengan `SISI_MAKS` pada CommunityAttachmentService. */
const SISI_MAKS = 1600;

const kering = process.argv.includes('--dry-run');
const storage = process.env.COMMUNITY_ATTACHMENT_STORAGE_PATH ?? '/data/community-attachments';
const prisma = new PrismaClient();

const rapi = (bytes) => `${(Number(bytes) / 1048576).toFixed(2)} MB`;

async function main() {
  const antre = await prisma.communityPostAttachment.findMany({
    where: { mimeType: { startsWith: 'image/' }, width: null },
    select: { id: true, objectKey: true, sizeBytes: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`${antre.length} gambar menunggu diolah di ${storage}${kering ? ' (dry-run)' : ''}`);

  let berhasil = 0;
  let dilewati = 0;
  let sebelum = 0n;
  let sesudah = 0n;

  for (const baris of antre) {
    const lama = join(storage, baris.objectKey);
    const objectKey = `${randomUUID()}.webp`;
    const sementara = join(storage, `${objectKey}.uploading`);
    const baru = join(storage, objectKey);
    try {
      const { width, height } = await sharp(lama)
        .autoOrient()
        .resize({ width: SISI_MAKS, height: SISI_MAKS, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(sementara);
      const ukuran = BigInt((await stat(sementara)).size);

      if (kering) {
        await rm(sementara, { force: true });
      } else {
        // Berkas baru lebih dulu utuh di tempatnya, lalu barisnya menunjuk ke
        // sana, dan yang lama baru dibuang. Urutan lain meninggalkan baris yang
        // menunjuk berkas yang sudah tidak ada.
        await rename(sementara, baru);
        await prisma.communityPostAttachment.update({
          where: { id: baris.id },
          data: { objectKey, mimeType: 'image/webp', sizeBytes: ukuran, width, height },
        });
        await rm(lama, { force: true });
      }

      sebelum += baris.sizeBytes;
      sesudah += ukuran;
      berhasil += 1;
      console.log(`  ${baris.objectKey} → ${objectKey}  ${rapi(baris.sizeBytes)} → ${rapi(ukuran)}  ${width}x${height}`);
    } catch (error) {
      // Satu berkas yang hilang atau rusak tidak boleh menghentikan sisanya;
      // barisnya dibiarkan apa adanya supaya masih terlihat pada jalannya lagi.
      await rm(sementara, { force: true });
      dilewati += 1;
      console.warn(`  LEWAT ${baris.objectKey}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`Selesai: ${berhasil} diolah, ${dilewati} dilewati, ${rapi(sebelum)} → ${rapi(sesudah)}`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
