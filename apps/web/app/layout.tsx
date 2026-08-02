import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NotifierProvider } from './components/notifier';
import './styles.css';

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
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <NotifierProvider>{children}</NotifierProvider>
      </body>
    </html>
  );
}
