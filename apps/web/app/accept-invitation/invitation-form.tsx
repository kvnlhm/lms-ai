'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';
import { PasswordInput } from '../components/password-input';

export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'Tautan undangan tidak lengkap.');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const passwordConfirmation = String(form.get('passwordConfirmation') ?? '');
    setBusy(true);
    setError(null);
    try {
      unwrap(
        await browserClient().POST('/api/v1/auth/accept-invitation', {
          body: { token, password, passwordConfirmation },
        }),
      );
      router.replace('/login?invitation=accepted');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="password">Password baru</label>
        <PasswordInput id="password" name="password" minLength={12} required disabled={busy || !token} />
      </div>
      <div className="field">
        <label htmlFor="passwordConfirmation">Ulangi password</label>
        <PasswordInput id="passwordConfirmation" name="passwordConfirmation" minLength={12} required disabled={busy || !token} />
      </div>
      {error ? <p className="fieldError" role="alert">{error}</p> : null}
      <button className="btn" type="submit" disabled={busy || !token}>
        {busy ? 'Mengaktifkan…' : 'Aktifkan akun'}
      </button>
    </form>
  );
}
