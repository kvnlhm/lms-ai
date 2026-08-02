import 'server-only';
import type { Schemas } from '@lms/api-client';
import { serverClient, unwrapList } from './api';

type AdminCourse = Schemas['AdminCourseListItemDto'];

/** Batas satu permintaan pada API daftar kursus admin. */
const UKURAN_HALAMAN = 100;

/**
 * Batas pengaman rantai permintaan.
 *
 * Seribu kursus sudah jauh melampaui apa pun yang wajar untuk satu akademi;
 * batas ini ada supaya katalog yang tumbuh tak terduga tidak diam-diam
 * berubah menjadi puluhan permintaan berantai setiap kali sebuah halaman
 * dibuka.
 */
const MAKS_HALAMAN = 10;

/**
 * Mengambil seluruh kursus, bukan hanya halaman pertamanya.
 *
 * Beberapa halaman memakai daftar kursus sebagai isi penyaring atau sebagai
 * dasar penjumlahan. Pada pemakaian seperti itu, mengambil satu halaman saja
 * bukan sekadar menampilkan lebih sedikit: kursus yang tidak termuat menjadi
 * kursus yang tidak dapat dipilih, tidak dapat dilaporkan, dan tidak ikut
 * terhitung — tanpa satu pun tanda bahwa ia ada.
 *
 * Pola itu ditemukan berulang di lima halaman berbeda, masing-masing dengan
 * salinan kodenya sendiri. Disatukan di sini supaya perbaikannya cukup sekali.
 *
 * `lengkap` bernilai false bila batas halaman tersentuh, sehingga pemanggil
 * dapat mengatakan bahwa angkanya sebagian — bukan menyajikannya seolah utuh.
 */
export async function ambilSemuaKursus(): Promise<{
  courses: AdminCourse[];
  total: number;
  lengkap: boolean;
}> {
  const client = await serverClient();
  const pertama = unwrapList<AdminCourse>(
    await client.GET('/api/v1/admin/courses', {
      params: { query: { page: 1, pageSize: UKURAN_HALAMAN } },
    }),
  );

  const courses = [...pertama.items];
  const halamanTerakhir = Math.min(pertama.meta.totalPages, MAKS_HALAMAN);
  for (let halaman = 2; halaman <= halamanTerakhir; halaman += 1) {
    const lanjutan = unwrapList<AdminCourse>(
      await client.GET('/api/v1/admin/courses', {
        params: { query: { page: halaman, pageSize: UKURAN_HALAMAN } },
      }),
    );
    courses.push(...lanjutan.items);
  }

  return {
    courses,
    total: pertama.meta.total,
    lengkap: courses.length >= pertama.meta.total,
  };
}
