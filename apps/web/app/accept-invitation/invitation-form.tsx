'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Check } from '../components/icons';
import { useNotifier } from '../components/notifier';
import { PasswordInput } from '../components/password-input';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

const PANJANG_MINIMUM = 12;

export function InvitationForm({ token }: { token: string }) {
  const notifier = useNotifier();
  const [busy, setBusy] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [password, setPassword] = useState('');
  const [ulangi, setUlangi] = useState('');

  const cukupPanjang = password.length >= PANJANG_MINIMUM;
  // Ketidakcocokan hanya diberitahukan setelah kolom kedua mulai diisi, supaya
  // peringatannya tidak muncul pada kolom yang memang masih kosong.
  const tidakCocok = ulangi.length > 0 && password !== ulangi;
  const siap = cukupPanjang && password === ulangi && !busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!siap) return;

    setBusy(true);
    try {
      unwrap(
        await browserClient().POST('/api/v1/auth/accept-invitation', {
          body: { token, password, passwordConfirmation: ulangi },
        }),
      );
      setSelesai(true);
    } catch (caught) {
      void notifier.error('Akun belum dapat diaktifkan', {
        text:
          caught instanceof ApiError
            ? caught.message
            : 'Tidak dapat menghubungi server. Coba lagi sebentar.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (selesai) {
    // Sebelumnya halaman ini langsung mengalihkan ke /login?invitation=accepted,
    // sementara halaman masuk tidak pernah membaca penanda itu — pengguna
    // mendarat tanpa satu pun tanda bahwa aktivasinya berhasil.
    return (
      <div className="activationDone">
        <span className="payIcon payIconBaik" aria-hidden="true">
          <Check size={26} strokeWidth={3} />
        </span>
        <h2>Akun aktif</h2>
        <p>Kata sandimu sudah tersimpan. Masuk memakai email dan kata sandi itu.</p>
        <Link className="btn btnBlock" href="/login">
          Masuk sekarang
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="password">Kata sandi baru</label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy || !token}
        />
        <span className={cukupPanjang ? 'fieldHint activationOk' : 'fieldHint'}>
          {cukupPanjang
            ? 'Panjangnya sudah cukup.'
            : `Minimal ${PANJANG_MINIMUM} karakter — baru ${password.length}.`}
        </span>
      </div>

      <div className="field">
        <label htmlFor="passwordConfirmation">Ulangi kata sandi</label>
        <PasswordInput
          id="passwordConfirmation"
          name="passwordConfirmation"
          autoComplete="new-password"
          value={ulangi}
          onChange={(event) => setUlangi(event.target.value)}
          disabled={busy || !token}
          aria-invalid={tidakCocok || undefined}
        />
        {tidakCocok ? (
          <span className="fieldError" role="alert">
            Kedua kata sandi belum sama.
          </span>
        ) : null}
      </div>

      <button className="btn btnBlock" type="submit" disabled={!siap || !token}>
        {busy ? 'Mengaktifkan…' : 'Aktifkan akun'}
      </button>
    </form>
  );
}
