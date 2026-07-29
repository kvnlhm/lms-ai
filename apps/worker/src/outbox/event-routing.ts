import type { QueueName } from '../queue-names';

/**
 * Tujuan antrean untuk setiap jenis event.
 *
 * Dipisahkan sebagai fungsi murni supaya pemetaannya dapat diuji tanpa Redis,
 * dan supaya penambahan event baru terlihat sebagai satu perubahan terpusat.
 */
const ROUTES: Record<string, QueueName[]> = {
  'learning.lesson_opened': ['analytics'],
  'learning.lesson_completed': ['analytics'],
  'learning.course_completed': ['analytics', 'notifications'],
};

export function destinationsFor(eventType: string): QueueName[] {
  return ROUTES[eventType] ?? [];
}

/**
 * ID job yang deterministik per pasangan event dan tujuan.
 *
 * BullMQ menolak custom ID yang mengandung titik dua karena Redis memakainya
 * sebagai pemisah key, jadi pemisahnya memakai dua garis bawah.
 */
export function jobIdFor(eventId: string, destination: QueueName): string {
  return `${eventId}__${destination}`;
}

/**
 * Backoff eksponensial dengan batas atas.
 *
 * Percobaan pertama menunggu 2 detik, lalu berlipat sampai 5 menit. Batas ini
 * mencegah event tertahan berjam-jam ketika dependensi pulih.
 */
export function retryDelayMs(attempts: number): number {
  const base = 2_000;
  const max = 300_000;
  return Math.min(max, base * 2 ** Math.max(0, attempts - 1));
}
