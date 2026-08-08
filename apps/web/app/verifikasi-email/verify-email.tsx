'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, Check } from '../components/icons';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

type Keadaan = { tahap: 'BERJALAN' } | { tahap: 'BERHASIL' } | { tahap: 'GAGAL'; pesan: string };

/**
 * Menukar token dari tautan email dengan bukti bahwa alamatnya memang dimiliki.
 *
 * Dikerjakan lewat POST dari klien, bukan dari GET halaman ini. Pemindai tautan
 * di aplikasi email dan pra-muat browser rutin membuka setiap URL yang mereka
 * temukan; token sekali pakai yang habis oleh sebuah pemindai akan menyisakan
 * pemiliknya dengan tautan yang sudah "terpakai" tanpa ia pernah menekannya.
 */
export function VerifyEmail({ token }: { token: string }) {
  const [keadaan, setKeadaan] = useState<Keadaan>({ tahap: 'BERJALAN' });

  useEffect(() => {
    let hidup = true;
    void (async () => {
      try {
        unwrap(
          await browserClient().POST('/api/v1/auth/email-verifications', { body: { token } }),
        );
        if (hidup) setKeadaan({ tahap: 'BERHASIL' });
      } catch (caught) {
        if (!hidup) return;
        setKeadaan({
          tahap: 'GAGAL',
          pesan:
            caught instanceof ApiError
              ? caught.message
              : 'Tidak dapat menghubungi server. Coba buka tautannya lagi.',
        });
      }
    })();
    return () => {
      hidup = false;
    };
  }, [token]);

  if (keadaan.tahap === 'BERJALAN') {
    return <p className="pageSub" role="status">Membuktikan alamat emailmu…</p>;
  }

  if (keadaan.tahap === 'BERHASIL') {
    return (
      <div className="activationDone" role="status">
        <span className="payIcon payIconBaik" aria-hidden="true">
          <Check size={26} strokeWidth={3} />
        </span>
        <h2>Alamat email terbukti</h2>
        <p>
          Akunmu siap dipakai. Kamu dapat menjelajahi katalog dan membuka pelajaran yang ditandai
          sebagai contoh.
        </p>
        <Link className="btn btnBlock" href="/courses">
          Lihat katalog
        </Link>
      </div>
    );
  }

  return (
    <div className="activationDone" role="alert">
      <span className="payIcon payIconGagal" aria-hidden="true">
        <AlertTriangle size={26} />
      </span>
      <h2>Tautan tidak dapat dipakai</h2>
      <p>{keadaan.pesan}</p>
      <p className="pageSub">
        Tautan pembuktian hanya berlaku sekali. Bila sudah terpakai atau kedaluwarsa, daftar ulang
        dengan alamat yang sama — kami akan mengirim tautan baru.
      </p>
      <Link className="btn btnBlock" href="/daftar-gratis">
        Minta tautan baru
      </Link>
    </div>
  );
}
