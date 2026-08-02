'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check } from '../components/icons';
import { useNotifier } from '../components/notifier';
import { PasswordInput } from '../components/password-input';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

const PANJANG_MINIMUM = 12;
const HITUNG_MUNDUR = 6;

export function PasswordForm() {
  const notifier = useNotifier();
  const [busy, setBusy] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulangi, setUlangi] = useState('');
  const [mundur, setMundur] = useState(HITUNG_MUNDUR);

  const cukupPanjang = baru.length >= PANJANG_MINIMUM;
  const tidakCocok = ulangi.length > 0 && baru !== ulangi;
  const siap = lama.length > 0 && cukupPanjang && baru === ulangi && !busy;

  /**
   * Mengubah kata sandi mencabut seluruh sesi, termasuk sesi halaman ini —
   * jadi kepindahan ke halaman masuk tidak dapat dihindari. Yang bisa
   * diperbaiki hanyalah membuatnya terbaca: sebelumnya kepindahan terjadi
   * diam-diam setelah 1,4 detik, waktu yang tidak cukup untuk membaca sebabnya.
   */
  useEffect(() => {
    if (!selesai) return undefined;
    if (mundur <= 0) {
      window.location.assign('/login');
      return undefined;
    }
    const jam = window.setTimeout(() => setMundur((detik) => detik - 1), 1000);
    return () => window.clearTimeout(jam);
  }, [selesai, mundur]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!siap) return;

    setBusy(true);
    try {
      unwrap(
        await browserClient().PATCH('/api/v1/auth/me/password', {
          body: {
            currentPassword: lama,
            newPassword: baru,
            newPasswordConfirmation: ulangi,
          },
        }),
      );
      setSelesai(true);
    } catch (caught) {
      setBusy(false);
      void notifier.error('Kata sandi belum berubah', {
        text:
          caught instanceof ApiError
            ? caught.message
            : 'Tidak dapat menghubungi server. Coba lagi sebentar.',
      });
    }
  }

  if (selesai) {
    return (
      <section className="card profileSection">
        <div className="activationDone" role="status">
          <span className="payIcon payIconBaik" aria-hidden="true">
            <Check size={26} strokeWidth={3} />
          </span>
          <h2>Kata sandi diubah</h2>
          <p>
            Seluruh perangkat yang masih masuk sudah dikeluarkan, termasuk yang sedang kamu pakai.
            Masuk kembali dengan kata sandi yang baru.
          </p>
          <button
            className="btn btnBlock"
            type="button"
            onClick={() => window.location.assign('/login')}
          >
            Masuk kembali{mundur > 0 ? ` (${mundur})` : ''}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card profileSection">
      <div className="profileSectionHead">
        <h2>Keamanan akun</h2>
        <p>
          Minimal {PANJANG_MINIMUM} karakter. Seluruh perangkat akan keluar setelah kata sandi
          berubah, termasuk perangkat ini.
        </p>
      </div>
      <form onSubmit={save} className="profileForm" noValidate>
        <div className="profileGrid">
          <div className="field profileFull">
            <label htmlFor="currentPassword">Kata sandi lama</label>
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              autoComplete="current-password"
              value={lama}
              onChange={(event) => setLama(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">Kata sandi baru</label>
            <PasswordInput
              id="newPassword"
              name="newPassword"
              autoComplete="new-password"
              value={baru}
              onChange={(event) => setBaru(event.target.value)}
              disabled={busy}
            />
            <span className={cukupPanjang ? 'fieldHint activationOk' : 'fieldHint'}>
              {cukupPanjang
                ? 'Panjangnya sudah cukup.'
                : `Minimal ${PANJANG_MINIMUM} karakter — baru ${baru.length}.`}
            </span>
          </div>
          <div className="field">
            <label htmlFor="newPasswordConfirmation">Ulangi kata sandi baru</label>
            <PasswordInput
              id="newPasswordConfirmation"
              name="newPasswordConfirmation"
              autoComplete="new-password"
              value={ulangi}
              onChange={(event) => setUlangi(event.target.value)}
              disabled={busy}
              aria-invalid={tidakCocok || undefined}
            />
            {tidakCocok ? (
              <span className="fieldError" role="alert">
                Kedua kata sandi belum sama.
              </span>
            ) : null}
          </div>
        </div>
        <div className="profileActions">
          <button className="btn" type="submit" disabled={!siap}>
            {busy ? 'Mengubah…' : 'Ubah kata sandi'}
          </button>
        </div>
      </form>
    </section>
  );
}
