import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '../components/brand-mark';
import { FreeRegistrationForm } from './free-registration-form';

export const metadata: Metadata = { title: 'Daftar gratis · Academy AIPreneur' };

/**
 * Pendaftaran tanpa pembayaran.
 *
 * Halaman ini menyebutkan batasnya lebih dulu, bukan sesudah orangnya masuk dan
 * menemukan pelajaran yang tidak terbuka. Menahan keterangan itu memang
 * menaikkan angka pendaftaran, dan menurunkan kepercayaan pada hal yang sama.
 */
export default function DaftarGratisPage() {
  return (
    <main className="authPage">
      <Link href="/login" className="brand activationBrand">
        <BrandMark />
        <span>Academy AIPreneur</span>
      </Link>

      <section className="authCard">
        <h1>Daftar gratis</h1>
        <p className="pageSub">
          Buat akun tanpa biaya untuk menjelajahi katalog, melihat seluruh daftar materi, dan
          membuka pelajaran yang ditandai sebagai contoh.
        </p>

        <ul className="freeScope">
          <li>Katalog dan seluruh daftar bagian serta pelajaran</li>
          <li>Pelajaran yang ditandai contoh oleh pengajar</li>
          <li>Membaca diskusi komunitas</li>
        </ul>
        <p className="freeScopeNote">
          Materi lengkap, menulis di komunitas, dan kelas langsung terbuka setelah mengambil
          akses. <Link href="/register">Lihat paketnya</Link>.
        </p>

        <FreeRegistrationForm />

        <p className="regLoginHint">
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </section>
    </main>
  );
}
