'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      unwrap(
        await browserClient().POST('/api/v1/auth/forgot-password', { body: { email } }),
      );
      setSentTo(email);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  // Pesan ini tidak boleh menyatakan emailnya terdaftar. API sengaja membalas
  // sama untuk alamat yang ada maupun tidak, dan teks di sini harus ikut
  // menjaga itu — kalau tidak, halamannya sendiri yang membocorkan.
  if (sentTo) {
    return (
      <div className="notice noticeInfo" role="status">
        <p>
          Jika <strong>{sentTo}</strong> terdaftar, tautan pemulihan sudah dikirim ke sana.
        </p>
        <p>
          Tautannya berlaku singkat dan hanya bisa dipakai sekali. Periksa juga folder spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@contoh.com"
          required
          disabled={busy}
        />
      </div>
      {error ? (
        <p className="fieldError" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Mengirim…' : 'Kirim tautan pemulihan'}
      </button>
    </form>
  );
}
