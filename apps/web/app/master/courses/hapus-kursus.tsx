'use client';

import { useRouter } from 'next/navigation';
import { useNotifier, type Notifier } from '../../components/notifier';
import { ApiError, browserClient, ensureSuccess } from '../../lib/browser-api';

/** Secukupnya untuk menghapus dan menyebut namanya di dialog konfirmasi. */
export interface KursusYangDihapus {
  id: string;
  title: string;
}

/**
 * Konfirmasi lalu penghapusan permanen sebuah kursus.
 *
 * Tinggal di berkas sendiri karena dipanggil dari dua tempat: menu aksi pada
 * daftar kursus dan halaman editornya. Peringatan sekeras ini tidak boleh
 * punya dua versi yang menyimpang diam-diam satu sama lain.
 *
 * Mengembalikan `true` hanya bila kursusnya benar-benar terhapus, sehingga
 * pemanggil yang menentukan apa yang terjadi sesudahnya — daftar memuat ulang
 * dirinya, editor berpindah karena halamannya ikut hilang.
 */
export async function konfirmasiHapusKursus(
  course: KursusYangDihapus,
  notifier: Notifier,
): Promise<boolean> {
  const lanjut = await notifier.confirm(`Hapus kursus "${course.title}"?`, {
    text:
      'Seluruh bagian, pelajaran, kuis, dan video di dalamnya ikut terhapus permanen. ' +
      'Untuk kursus yang sudah pernah dipakai pelajar, gunakan arsip.',
    confirmLabel: 'Hapus permanen',
    danger: true,
  });
  if (!lanjut) return false;

  return kirimHapus(course, notifier, false);
}

/**
 * Mengirim permintaan hapus, dan menawarkan penghapusan paksa bila server
 * menolak karena kursusnya sudah punya enrollment.
 *
 * Server tetap pemegang aturannya: kursus yang sudah dipakai ditolak dengan
 * 409 dan diarahkan ke arsip, supaya riwayat belajar tidak ikut terhapus tanpa
 * disadari. Peringatannya datang dari server, bukan disalin ke sini — kalau
 * aturannya berubah kelak, teks yang dibaca Master ikut berubah sendiri.
 */
async function kirimHapus(
  course: KursusYangDihapus,
  notifier: Notifier,
  force: boolean,
): Promise<boolean> {
  try {
    ensureSuccess(
      await browserClient().DELETE('/api/v1/admin/courses/{courseId}', {
        params: { path: { courseId: course.id }, query: force ? { force: true } : {} },
      }),
    );
    return true;
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 409 && !force) {
      const tetap = await notifier.confirm('Tetap hapus kursus ini?', {
        text:
          `${caught.message} Bila diteruskan, seluruh pendaftaran pelajar pada kursus ini ` +
          'ikut terhapus permanen beserta progres belajar dan percobaan kuisnya. ' +
          'Tidak ada cara mengembalikannya selain dari backup.',
        confirmLabel: 'Hapus berikut riwayatnya',
        cancelLabel: 'Batal',
        danger: true,
      });
      return tetap ? kirimHapus(course, notifier, true) : false;
    }

    void notifier.error('Kursus tidak dapat dihapus', {
      text:
        caught instanceof ApiError
          ? caught.message
          : 'Tidak dapat menghubungi server. Kursus belum terhapus.',
    });
    return false;
  }
}

/**
 * Butir "Hapus kursus" pada menu aksi di daftar kursus.
 *
 * Tidak menyimpan keadaan sibuk: menekan butir ini menutup menunya, sehingga
 * tombolnya lenyap sebelum sempat menampilkan apa pun. Yang menahan perhatian
 * adalah dialog konfirmasinya, dan sesudahnya daftar memuat ulang dirinya
 * sehingga baris yang terhapus benar-benar hilang, bukan sekadar diam.
 */
export function TombolHapusKursus({ course }: { course: KursusYangDihapus }) {
  const router = useRouter();
  const notifier = useNotifier();

  return (
    <button
      type="button"
      className="btnTiny btnDanger"
      onClick={async () => {
        if (!(await konfirmasiHapusKursus(course, notifier))) return;
        notifier.success(`Kursus "${course.title}" dihapus.`);
        router.refresh();
      }}
    >
      Hapus kursus
    </button>
  );
}
