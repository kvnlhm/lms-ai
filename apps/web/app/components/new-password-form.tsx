'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Check } from './icons';
import { useNotifier } from './notifier';
import { PasswordInput } from './password-input';
import { ApiError } from '../lib/browser-api';

/** Aturan yang sama ditegakkan API; disebutkan di sini agar terbaca sebelum ditolak. */
const PANJANG_MINIMUM = 12;

/**
 * Formulir membuat kata sandi baru.
 *
 * Dipakai bersama oleh aktivasi akun dan atur ulang kata sandi. Keduanya
 * meminta hal yang sama persis — dua kolom sandi, satu token dari tautan
 * email — dan sebelumnya ditulis terpisah dengan isi yang nyaris sama.
 * Menyatukannya menjaga keduanya tidak menyimpang: petunjuk panjang,
 * pemeriksaan kecocokan, dan keadaan berhasil selalu sama di dua halaman.
 *
 * Permintaannya diserahkan lewat `kirim` supaya tiap halaman memakai alamat
 * endpoint-nya sendiri sebagai literal, sehingga tipenya tetap terperiksa.
 */
export function NewPasswordForm({
  token,
  kirim,
  labelTombol,
  labelSibuk,
  judulBerhasil,
  pesanBerhasil,
  judulGagal,
}: {
  token: string;
  kirim: (password: string, konfirmasi: string) => Promise<unknown>;
  labelTombol: string;
  labelSibuk: string;
  judulBerhasil: string;
  pesanBerhasil: string;
  judulGagal: string;
}) {
  const notifier = useNotifier();
  const [busy, setBusy] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [password, setPassword] = useState('');
  const [ulangi, setUlangi] = useState('');

  const cukupPanjang = password.length >= PANJANG_MINIMUM;
  // Ketidakcocokan hanya diberitahukan setelah kolom kedua mulai diisi, supaya
  // peringatannya tidak menegur kolom yang memang masih kosong.
  const tidakCocok = ulangi.length > 0 && password !== ulangi;
  const siap = cukupPanjang && password === ulangi && !busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!siap) return;

    setBusy(true);
    try {
      await kirim(password, ulangi);
      setSelesai(true);
    } catch (caught) {
      void notifier.error(judulGagal, {
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
    // Keberhasilan ditampilkan di sini, bukan dengan mengalihkan ke halaman
    // masuk: kedua halaman dulu mengirim penanda pada URL — `invitation=accepted`
    // dan `password=reset` — yang tidak pernah dibaca halaman masuk, sehingga
    // pengguna mendarat tanpa tanda apa pun bahwa langkahnya berhasil.
    return (
      <div className="activationDone">
        <span className="payIcon payIconBaik" aria-hidden="true">
          <Check size={26} strokeWidth={3} />
        </span>
        <h2>{judulBerhasil}</h2>
        <p>{pesanBerhasil}</p>
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
        {busy ? labelSibuk : labelTombol}
      </button>
    </form>
  );
}
