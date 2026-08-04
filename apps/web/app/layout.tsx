import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NotifierProvider } from './components/notifier';
import './styles.css';

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
  title: 'Academy AIPreneur',
  description: 'Platform pembelajaran coding, AI, bisnis, marketing, dan kesiapan kerja.',
  // Salinan non-produksi tidak boleh terindeks. Staging yang muncul di hasil
  // pencarian akan menarik pelajar sungguhan ke data uji, dan memecah peringkat
  // domain yang sama menjadi dua.
  ...(PRODUKSI ? {} : { robots: { index: false, follow: false } }),
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
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
