'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const JEDA_DETIK = 8;

/**
 * Memeriksa ulang status pembayaran secara berkala.
 *
 * Konfirmasi dari Midtrans tiba lewat webhook ke server, bukan ke peramban
 * pembeli. Tanpa pemeriksaan ulang, halaman ini akan terus menampilkan
 * "menunggu pembayaran" meski uangnya sudah masuk beberapa detik lalu — dan
 * pembeli tidak punya cara mengetahuinya selain memuat ulang sendiri.
 *
 * `router.refresh()` dipakai, bukan tautan ke alamat yang sama: menautkan
 * halaman ke dirinya sendiri tidak dijamin mengambil ulang data dari server.
 */
export function StatusRefresher() {
  const router = useRouter();
  const [sisa, setSisa] = useState(JEDA_DETIK);
  const [memeriksa, setMemeriksa] = useState(false);

  useEffect(() => {
    const jam = window.setInterval(() => {
      setSisa((detik) => {
        if (detik > 1) return detik - 1;
        setMemeriksa(true);
        router.refresh();
        window.setTimeout(() => setMemeriksa(false), 900);
        return JEDA_DETIK;
      });
    }, 1000);
    return () => window.clearInterval(jam);
  }, [router]);

  return (
    <div className="payRefresh">
      <button
        type="button"
        className="btn btnGhost"
        onClick={() => {
          setMemeriksa(true);
          setSisa(JEDA_DETIK);
          router.refresh();
          window.setTimeout(() => setMemeriksa(false), 900);
        }}
      >
        Periksa sekarang
      </button>
      <span aria-live="polite">
        {memeriksa ? 'Memeriksa…' : `Memeriksa otomatis dalam ${sisa} detik`}
      </span>
    </div>
  );
}
