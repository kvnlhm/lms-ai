/**
 * Pemformatan yang dipakai bersama oleh perpustakaan video, pemilih video, dan
 * penjelajah library Bunny.
 *
 * Dipisahkan ke sini bukan demi kerapian, melainkan karena penjelajah Bunny
 * dipasang di dalam pemilih video: kalau keduanya saling mengimpor, muncul
 * lingkaran impor yang perilakunya bergantung pada urutan bundling.
 */

/**
 * Nama penyedia untuk dibaca manusia.
 *
 * Sebelumnya apa pun yang bukan YouTube disebut "Self-hosted", sehingga video
 * Bunny — yang justru tidak disimpan di server kita — mengaku sebaliknya.
 */
export function namaPenyedia(provider: string): string {
  if (provider === 'YOUTUBE') return 'YouTube';
  if (provider === 'BUNNY_STREAM') return 'Bunny Stream';
  return 'Self-hosted';
}

export function formatBytes(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const satuan = ['B', 'KB', 'MB', 'GB', 'TB'];
  const tingkat = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), satuan.length - 1);
  const angka = bytes / 1024 ** tingkat;
  return `${angka.toFixed(angka >= 10 || tingkat === 0 ? 0 : 1)} ${satuan[tingkat]}`;
}
