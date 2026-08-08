import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NotifierProvider } from './components/notifier';
import './styles.css';
import lambangGelap from './icon-gelap.png';

/**
 * Lingkungan tempat salinan ini berjalan.
 *
 * Dibaca sebagai env biasa, bukan `NEXT_PUBLIC_`, karena berkas ini komponen
 * server: nilainya dibaca saat berjalan, sehingga satu image yang sama dapat
 * dipakai produksi maupun staging tanpa dibangun ulang.
 */
const LINGKUNGAN = process.env.APP_ENV ?? 'local';
const PRODUKSI = LINGKUNGAN === 'production';

/**
 * Judul bawaan untuk halaman yang tidak menetapkan judulnya sendiri.
 *
 * Sengaja tanpa "| Admin": judul ini juga dipakai beranda, katalog, pemutar
 * pelajaran, profil, dan halaman atur ulang password — menandai halaman
 * pelajar sebagai Admin justru menyesatkan. Sisi Master mendapat judulnya
 * sendiri lewat app/master/layout.tsx.
 */
export const metadata: Metadata = {
  title: {
    default: 'Pelajar · Academy AIPreneur',
    template: '%s · Pelajar',
  },
  description: 'Platform pembelajaran coding, AI, bisnis, marketing, dan kesiapan kerja.',
  // Salinan non-produksi tidak boleh terindeks. Staging yang muncul di hasil
  // pencarian akan menarik pelajar sungguhan ke data uji, dan memecah peringkat
  // domain yang sama menjadi dua.
  ...(PRODUKSI ? {} : { robots: { index: false, follow: false } }),
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      {/* Ikon tab kedua, untuk bilah tab mode gelap. Lambang bertinta gelap
          nyaris hilang di sana, jadi satu berkas saja berarti separuh pengguna
          melihat ruang kosong di tabnya.

          Ditulis sebagai `<link>` alih-alih lewat `metadata.icons`, karena
          mengisi `metadata.icons` mematikan tautan bawaan yang disisipkan Next
          dari `app/icon.png` — dan tautan bawaan itulah yang membawa sidik jari
          isi berkas. Tanpa sidik jari, `/icon.png` polos dilayani
          `immutable, max-age=31536000` dan lambang yang sudah diganti tetap
          tampil versi lama tanpa cara memberi tahu browser. Berkas gelapnya
          diimpor supaya alamatnya ikut ber-sidik jari. */}
      <link rel="icon" type="image/png" href={lambangGelap.src} media="(prefers-color-scheme: dark)" />
      <body>
        {/* Penanda yang sulit dilewatkan. Tanpanya, staging dan produksi tampak
            persis sama — dan orang akan mengira sudah menghapus sesuatu di
            tempat yang salah. */}
        {PRODUKSI ? null : (
          <div className="envBanner" role="status">
            Lingkungan <strong>{LINGKUNGAN}</strong> — data di sini bukan data sungguhan
          </div>
        )}
        <NotifierProvider>{children}</NotifierProvider>
      </body>
    </html>
  );
}
