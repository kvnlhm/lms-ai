'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Check } from '../components/icons';
import { useNotifier } from '../components/notifier';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

/** Sama dengan aturan server; disebut di sini supaya tidak perlu ditolak dulu. */
const PANJANG_SANDI_MIN = 12;

export function FreeRegistrationForm() {
  const notifier = useNotifier();
  const [busy, setBusy] = useState(false);
  const [terkirim, setTerkirim] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get('fullName') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const passwordConfirmation = String(data.get('passwordConfirmation') ?? '');

    // Dijaga di sini supaya kesalahan yang paling sering terjadi dijawab tanpa
    // perjalanan ke server, dan tanpa kolom sandi yang terhapus sesudahnya.
    if (password !== passwordConfirmation) {
      void notifier.error('Kata sandi belum cocok', {
        text: 'Isi kedua kolom kata sandi dengan nilai yang sama.',
      });
      return;
    }

    setBusy(true);
    try {
      unwrap(
        await browserClient().POST('/api/v1/auth/free-registrations', {
          body: { fullName, email, password, passwordConfirmation },
        }),
      );
      setTerkirim(email);
    } catch (caught) {
      void notifier.error('Pendaftaran belum selesai', {
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
        reasons: caught instanceof ApiError ? Object.values(caught.fields ?? {}).flat() : [],
      });
    } finally {
      setBusy(false);
    }
  }

  // Teks ini tidak boleh menyatakan alamatnya belum pernah terdaftar. API
  // sengaja membalas sama untuk alamat yang sudah ada maupun belum, dan halaman
  // yang lebih cerewet dari API-nya sendirilah yang akhirnya membocorkan.
  if (terkirim) {
    return (
      <div className="activationDone" role="status">
        <span className="payIcon payIconBaik" aria-hidden="true">
          <Check size={26} strokeWidth={3} />
        </span>
        <h2>Periksa emailmu</h2>
        <p>
          Kami mengirim tautan pembuktian ke <strong>{terkirim}</strong>. Buka tautan itu untuk
          mulai memakai akunmu. Periksa juga folder spam.
        </p>
        <Link className="btn btnBlock" href="/login">
          Ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="field">
        <span>Nama lengkap</span>
        <input name="fullName" type="text" required minLength={2} maxLength={120} autoComplete="name" />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" required maxLength={255} autoComplete="email" />
      </label>
      <label className="field">
        <span>Kata sandi</span>
        <input
          name="password"
          type="password"
          required
          minLength={PANJANG_SANDI_MIN}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <label className="field">
        <span>Ulangi kata sandi</span>
        <input
          name="passwordConfirmation"
          type="password"
          required
          minLength={PANJANG_SANDI_MIN}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <p className="fieldHint">Minimal {PANJANG_SANDI_MIN} karakter.</p>
      <button className="btn btnBlock" type="submit" disabled={busy}>
        {busy ? 'Mendaftarkan…' : 'Daftar gratis'}
      </button>
    </form>
  );
}
