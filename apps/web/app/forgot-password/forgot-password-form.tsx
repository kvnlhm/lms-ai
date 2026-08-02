'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Check } from '../components/icons';
import { useNotifier } from '../components/notifier';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

export function ForgotPasswordForm() {
  const notifier = useNotifier();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    setBusy(true);
    try {
      unwrap(
        await browserClient().POST('/api/v1/auth/forgot-password', { body: { email } }),
      );
      setSentTo(email);
    } catch (caught) {
      void notifier.error('Tautan pemulihan gagal dikirim', {
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
      });
    } finally {
      setBusy(false);
    }
  }

  // Pesan ini tidak boleh menyatakan emailnya terdaftar. API sengaja membalas
  // sama untuk alamat yang ada maupun tidak, dan teks di sini harus ikut
  // menjaga itu — kalau tidak, halamannya sendiri yang membocorkan.
  if (sentTo) {
    return (
      <div className="activationDone" role="status">
        <span className="payIcon payIconBaik" aria-hidden="true">
          <Check size={26} strokeWidth={3} />
        </span>
        <h2>Periksa emailmu</h2>
        <p>
          Jika <strong>{sentTo}</strong> terdaftar, tautan pemulihan sudah dikirim ke sana.
          Tautannya berlaku singkat dan hanya bisa dipakai sekali. Periksa juga folder spam.
        </p>
        <div className="forgotAgain">
          <Link className="btn btnBlock" href="/login">
            Ke halaman masuk
          </Link>
          {/* Jalan keluar bila alamatnya salah ketik: tanpa ini satu-satunya
              cara mengulang adalah memuat ulang halaman sendiri. */}
          <button className="btnTiny" type="button" onClick={() => setSentTo(null)}>
            Kirim ke alamat lain
          </button>
        </div>
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
      <button className="btn btnBlock" type="submit" disabled={busy}>
        {busy ? 'Mengirim…' : 'Kirim tautan pemulihan'}
      </button>
    </form>
  );
}
