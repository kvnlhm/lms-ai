import { createHash } from 'node:crypto';

/** Panjang aman untuk kolom teks; galat tidak boleh menjadi beban penyimpanan. */
export const MAX_MESSAGE_LENGTH = 500;
export const MAX_STACK_LENGTH = 4_000;

export interface FingerprintInput {
  source: string;
  type: string;
  message: string;
  stack?: string;
  /** Rute yang gagal; ikut membedakan galat generik seperti "fetch failed". */
  route?: string;
}

/**
 * Menyatukan kejadian yang sebenarnya satu masalah.
 *
 * Tanpa normalisasi, "Pengguna 3f2a… tidak ditemukan" dan "Pengguna 9b1c…
 * tidak ditemukan" menjadi dua kelompok berbeda, sehingga satu bug menghasilkan
 * satu surat per pengguna yang terkena. Angka, UUID, dan nilai dalam kutip
 * karenanya diganti penanda sebelum di-hash.
 */
export function normaliseMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
    .replace(/\b0x[0-9a-f]+\b/gi, '{hex}')
    .replace(/"[^"]*"/g, '"{str}"')
    .replace(/'[^']*'/g, "'{str}'")
    .replace(/\b\d+\b/g, '{n}')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * Bingkai tumpukan pertama yang merupakan kode kita sendiri.
 *
 * Bingkai dari `node_modules` hampir selalu sama untuk galat yang berbeda —
 * memakainya sebagai pembeda justru menggabungkan masalah yang tidak
 * berhubungan.
 */
export function topFrame(stack: string | undefined): string {
  if (!stack) return '';
  for (const line of stack.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;
    if (trimmed.includes('node_modules') || trimmed.includes('node:internal')) continue;
    // Nomor baris ikut dibuang supaya penambahan satu baris kode di atasnya
    // tidak memecah riwayat galat yang sama menjadi kelompok baru.
    return trimmed.replace(/:\d+:\d+\)?$/, ')');
  }
  return '';
}

export function fingerprintOf(input: FingerprintInput): string {
  const parts = [
    input.source,
    input.type,
    normaliseMessage(input.message),
    topFrame(input.stack),
    input.route ?? '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40);
}

export function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}
