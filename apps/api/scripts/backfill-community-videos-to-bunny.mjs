/**
 * Memindahkan video lampiran komunitas yang masih tersimpan di volume kita ke
 * Bunny Stream.
 *
 * Urutannya yang menentukan, dan tidak boleh dibalik:
 *
 *   1. buat video di Bunny dan unggah berkasnya
 *   2. tunggu Bunny selesai mentranscode
 *   3. baru tukar lampirannya menjadi ber-Bunny, dalam satu UPDATE
 *   4. baru hapus berkas lokalnya
 *
 * Selama langkah 1–2 berjalan — dan itu dapat memakan menit — lampirannya masih
 * menunjuk berkas lokal dan tampil seperti biasa. Kegagalan di mana pun sebelum
 * langkah 3 tidak mengubah apa pun yang dilihat pembaca; yang tertinggal hanya
 * video yatim di Bunny, yang ikut tercatat sebagai `VideoAsset` sehingga masih
 * dapat ditemukan dan dibersihkan.
 *
 * Constraint `satu_sumber` di basis data menolak baris yang menunjuk keduanya
 * atau tidak menunjuk apa pun, jadi langkah 3 memang tidak dapat setengah jadi.
 *
 *   node scripts/backfill-community-videos-to-bunny.mjs [--dry-run]
 *
 * Butuh DATABASE_URL, COMMUNITY_ATTACHMENT_STORAGE_PATH, BUNNY_STREAM_LIBRARY_ID,
 * dan BUNNY_STREAM_API_KEY — semuanya sudah ada di kontainer API.
 */
import { PrismaClient } from '@prisma/client';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const kering = process.argv.includes('--dry-run');
const storage = process.env.COMMUNITY_ATTACHMENT_STORAGE_PATH ?? '/data/community-attachments';
const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
const apiKey = process.env.BUNNY_STREAM_API_KEY;
if (!libraryId || !apiKey) {
  console.error('BUNNY_STREAM_LIBRARY_ID dan BUNNY_STREAM_API_KEY wajib terisi.');
  process.exit(1);
}

const prisma = new PrismaClient();
const dasar = `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}`;
const kepala = { AccessKey: apiKey, Accept: 'application/json' };
const rapi = (b) => `${(Number(b) / 1048576).toFixed(2)} MB`;
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

async function bunny(path, init = {}) {
  const response = await fetch(`${dasar}${path}`, { ...init, headers: { ...kepala, ...init.headers } });
  if (!response.ok) throw new Error(`Bunny ${init.method ?? 'GET'} ${path} → ${response.status}`);
  return response.status === 204 ? null : response.json();
}

/**
 * Menunggu Bunny selesai. `status` 4 berarti siap, 5 dan 6 berarti gagal —
 * angka-angka itu milik Bunny, bukan kita.
 */
async function tungguSiap(videoId, batasDetik = 900) {
  const akhir = Date.now() + batasDetik * 1000;
  while (Date.now() < akhir) {
    const meta = await bunny(`/videos/${encodeURIComponent(videoId)}`);
    if (meta.status === 4) return { siap: true, ukuran: meta.storageSize ?? null };
    if (meta.status === 5 || meta.status === 6) return { siap: false, ukuran: null };
    await tunggu(5000);
  }
  throw new Error(`Bunny belum selesai setelah ${batasDetik} detik.`);
}

async function main() {
  const antre = await prisma.communityPostAttachment.findMany({
    where: { mimeType: { startsWith: 'video/' }, objectKey: { not: null } },
    select: { id: true, objectKey: true, originalName: true, sizeBytes: true, uploaderId: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`${antre.length} video menunggu dipindahkan${kering ? ' (dry-run)' : ''}`);

  let berhasil = 0, dilewati = 0, sebelum = 0n, sesudah = 0n;

  for (const baris of antre) {
    const lokal = join(storage, baris.objectKey);
    try {
      const isi = await readFile(lokal);

      if (kering) {
        console.log(`  ${baris.objectKey} → (dry-run) ${rapi(isi.length)}`);
        dilewati += 1;
        continue;
      }

      // 1. Wadah di Bunny, lalu berkasnya.
      const dibuat = await bunny('/videos', {
        method: 'POST',
        body: JSON.stringify({ title: baris.originalName }),
        headers: { 'Content-Type': 'application/json' },
      });
      const videoId = dibuat.guid;
      await bunny(`/videos/${encodeURIComponent(videoId)}`, {
        method: 'PUT',
        body: isi,
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      // Aset dicatat sesudah unggahannya diterima, sebelum menunggu transcode:
      // kalau proses ini mati saat menunggu, videonya tetap dapat ditemukan.
      const aset = await prisma.videoAsset.create({
        data: {
          createdBy: baris.uploaderId,
          provider: 'BUNNY_STREAM',
          providerVideoId: videoId,
          title: baris.originalName,
          originalName: baris.originalName,
          status: 'PROCESSING',
        },
        select: { id: true },
      });

      // 2. Tunggu sampai benar-benar dapat diputar.
      const { siap, ukuran } = await tungguSiap(videoId);
      if (!siap) {
        await prisma.videoAsset.update({
          where: { id: aset.id },
          data: { status: 'FAILED', processingError: 'Bunny gagal memproses video ini.' },
        });
        console.warn(`  LEWAT ${baris.objectKey}: Bunny gagal memproses; lampirannya dibiarkan memakai berkas lokal.`);
        dilewati += 1;
        continue;
      }
      await prisma.videoAsset.update({
        where: { id: aset.id },
        data: { status: 'AVAILABLE', sizeBytes: ukuran === null ? undefined : BigInt(ukuran) },
      });

      // 3. Satu UPDATE. Constraint `satu_sumber` menolak keadaan setengah jadi.
      await prisma.communityPostAttachment.update({
        where: { id: baris.id },
        data: { objectKey: null, videoAssetId: aset.id, sizeBytes: BigInt(ukuran ?? isi.length) },
      });

      // 4. Baru berkas lokalnya. Terbalik, dan proses yang mati di antaranya
      //    meninggalkan lampiran yang menunjuk berkas yang sudah tidak ada.
      await rm(lokal, { force: true });

      sebelum += baris.sizeBytes;
      sesudah += BigInt(ukuran ?? isi.length);
      berhasil += 1;
      console.log(`  ${baris.objectKey} → bunny:${videoId}  ${rapi(baris.sizeBytes)} → ${rapi(ukuran ?? isi.length)}`);
    } catch (error) {
      // Apa pun yang gagal sebelum langkah 3 tidak mengubah yang dilihat
      // pembaca: lampirannya masih menunjuk berkas lokal.
      dilewati += 1;
      console.warn(`  LEWAT ${baris.objectKey}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`Selesai: ${berhasil} dipindahkan, ${dilewati} dilewati, ${rapi(sebelum)} dibebaskan dari volume`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
