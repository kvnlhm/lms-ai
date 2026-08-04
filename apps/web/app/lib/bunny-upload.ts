import type { Schemas } from '@lms/api-client';
import { browserClient, unwrap } from './browser-api';

type Ticket = Schemas['BunnyUploadTicketDto'];

/**
 * Potongan 16 MB. Cukup besar agar sambungan cepat tidak dihabiskan oleh
 * bolak-balik permintaan, cukup kecil agar sambungan yang putus tidak
 * mengulang banyak pekerjaan — dan agar bilah kemajuan bergerak.
 */
const UKURAN_POTONGAN = 16 * 1024 * 1024;
const TUS_VERSION = '1.0.0';

/** Metadata TUS: pasangan `kunci nilai-base64`, dipisah koma. */
function metadata(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([kunci, nilai]) => `${kunci} ${btoa(unescape(encodeURIComponent(nilai)))}`)
    .join(',');
}

function tiketHeaders(ticket: Ticket): Record<string, string> {
  return {
    AuthorizationSignature: ticket.signature,
    AuthorizationExpire: String(ticket.expires),
    VideoId: ticket.videoId,
    LibraryId: ticket.libraryId,
    'Tus-Resumable': TUS_VERSION,
  };
}

/**
 * Mengunggah satu berkas video langsung dari peramban ke Bunny.
 *
 * Berkasnya tidak pernah menyentuh server akademi. Yang diminta dari server
 * hanyalah tiket: satu wadah video kosong beserta tanda tangan yang hanya
 * berlaku untuk wadah itu dan hanya sampai waktu tertentu. API key Bunny ikut
 * membentuk tanda tangan tetapi tidak pernah dikirim ke sini — kalau ia sampai
 * ke peramban, siapa pun yang membuka devtools memegang seluruh library.
 *
 * Protokolnya TUS, dipilih karena berkas kelas berukuran ratusan megabyte
 * sampai beberapa gigabyte. Unggahan satu tembakan yang putus di menit ke-9
 * harus diulang dari nol; TUS menanyakan lebih dulu berapa byte yang sudah
 * diterima Bunny, lalu melanjutkan dari sana.
 */
export async function unggahKeBunny(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ videoId: string; title: string }> {
  const ticket = unwrap<Ticket>(
    await browserClient().POST('/api/v1/admin/videos/bunny/upload-tickets', {
      body: { title: file.name },
    }),
  );

  const buat = await fetch(ticket.endpoint, {
    method: 'POST',
    headers: {
      ...tiketHeaders(ticket),
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata({ filetype: file.type || 'video/mp4', title: file.name }),
    },
  });
  if (buat.status !== 201) {
    throw new Error(`Bunny menolak memulai unggahan (${buat.status}).`);
  }

  const lokasi = buat.headers.get('Location');
  if (!lokasi) throw new Error('Bunny tidak memberi alamat lanjutan untuk unggahan ini.');
  const alamat = new URL(lokasi, ticket.endpoint).toString();

  let offset = 0;
  onProgress(0);

  while (offset < file.size) {
    const akhir = Math.min(offset + UKURAN_POTONGAN, file.size);
    let response: Response;
    try {
      response = await fetch(alamat, {
        method: 'PATCH',
        headers: {
          ...tiketHeaders(ticket),
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: file.slice(offset, akhir),
      });
    } catch {
      // Sambungan putus di tengah potongan. Yang menentukan bukan tebakan kita
      // melainkan berapa byte yang benar-benar sudah diterima Bunny.
      offset = await offsetTerkini(alamat, ticket);
      onProgress(Math.round((offset / file.size) * 100));
      continue;
    }

    if (response.status === 409 || response.status === 460) {
      // Offset kita tidak sesuai catatan Bunny; ikuti catatannya, bukan kita.
      offset = await offsetTerkini(alamat, ticket);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Bunny menolak potongan unggahan (${response.status}).`);
    }

    const lanjut = Number(response.headers.get('Upload-Offset'));
    offset = Number.isFinite(lanjut) && lanjut > offset ? lanjut : akhir;
    onProgress(Math.round((offset / file.size) * 100));
  }

  return { videoId: ticket.videoId, title: file.name };
}

async function offsetTerkini(alamat: string, ticket: Ticket): Promise<number> {
  const response = await fetch(alamat, { method: 'HEAD', headers: tiketHeaders(ticket) });
  if (!response.ok) throw new Error('Unggahan terputus dan tidak dapat dilanjutkan.');
  const offset = Number(response.headers.get('Upload-Offset'));
  if (!Number.isFinite(offset)) throw new Error('Bunny tidak menyebut posisi unggahan terakhir.');
  return offset;
}
