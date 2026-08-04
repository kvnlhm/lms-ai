'use client';

/**
 * Berapa banyak sebuah video benar-benar ditonton.
 *
 * Dipakai bersama oleh dua komponen bersaudara — pemutar yang mengukurnya dan
 * tombol selesai yang melaporkannya — tanpa mengubah halaman pelajaran menjadi
 * satu komponen klien raksasa. Karena itu penyimpanannya sederhana: sebuah peta
 * di dalam modul, ditambah langganan agar tombolnya ikut hidup saat angkanya
 * berubah.
 *
 * Yang dicatat adalah **detik yang dilalui sambil memutar**, bukan posisi
 * terjauh. Bedanya menentukan: menyeret penggeser ke ujung membuat posisi
 * terjauh langsung 100% tanpa satu detik pun ditonton, sedangkan akumulasi
 * hanya bertambah saat waktu benar-benar berjalan maju dalam langkah kecil.
 */

type Pendengar = (persen: number) => void;

const ditonton = new Map<string, { detik: number; durasi: number }>();
const pendengar = new Map<string, Set<Pendengar>>();

/** Lompatan yang lebih besar dari ini dianggap seek, bukan menonton. */
const LANGKAH_WAJAR_DETIK = 2;

function siarkan(lessonId: string): void {
  const persen = persenDitonton(lessonId);
  for (const dengar of pendengar.get(lessonId) ?? []) dengar(persen);
}

/** Melaporkan kemajuan pemutaran; aman dipanggil sesering `timeupdate`. */
export function catatKemajuan(
  lessonId: string,
  posisiDetik: number,
  durasiDetik: number,
  posisiSebelumnya: number,
): void {
  if (!Number.isFinite(durasiDetik) || durasiDetik <= 0) return;
  const maju = posisiDetik - posisiSebelumnya;
  const sebelum = ditonton.get(lessonId);
  const detik = (sebelum?.detik ?? 0) + (maju > 0 && maju <= LANGKAH_WAJAR_DETIK ? maju : 0);
  ditonton.set(lessonId, { detik: Math.min(detik, durasiDetik), durasi: durasiDetik });
  siarkan(lessonId);
}

/** Persentase bulat yang sudah ditonton; 0 bila belum ada yang tercatat. */
export function persenDitonton(lessonId: string): number {
  const catatan = ditonton.get(lessonId);
  if (!catatan || catatan.durasi <= 0) return 0;
  return Math.min(100, Math.floor((catatan.detik / catatan.durasi) * 100));
}

export function langgananKemajuan(lessonId: string, dengar: Pendengar): () => void {
  const daftar = pendengar.get(lessonId) ?? new Set<Pendengar>();
  daftar.add(dengar);
  pendengar.set(lessonId, daftar);
  return () => {
    daftar.delete(dengar);
    if (daftar.size === 0) pendengar.delete(lessonId);
  };
}
