'use client';

import { useEffect } from 'react';
import { reportClientError } from './lib/report-error';

/**
 * Jaring terakhir ketika render gagal total.
 *
 * Next.js mengganti seluruh dokumen di sini, jadi `html` dan `body` harus
 * ditulis sendiri — layout root tidak ikut dipakai. Stylesheet global juga
 * tidak termuat, maka gayanya ditulis inline: halaman ini muncul justru ketika
 * segala sesuatu yang lain sudah rusak.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0b0f',
          color: '#e8e8ee',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '24px',
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Ada yang tidak beres</h1>
          <p style={{ opacity: 0.75, lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Halaman ini gagal dimuat. Kejadiannya sudah tercatat dan akan kami periksa. Coba muat
            ulang — kalau masih sama, kembali sebentar lagi.
          </p>
          {error.digest ? (
            <p style={{ opacity: 0.45, fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              Kode kejadian: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#5b5bd6',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.7rem 1.4rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Muat ulang
          </button>
        </main>
      </body>
    </html>
  );
}
