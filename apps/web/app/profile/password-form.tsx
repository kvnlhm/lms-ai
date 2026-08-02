'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';
import { PasswordInput } from '../components/password-input';

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get('newPassword') ?? '');
    const confirmation = String(data.get('newPasswordConfirmation') ?? '');
    if (newPassword !== confirmation) {
      setMessage({ kind: 'error', text: 'Konfirmasi password baru tidak sama.' });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      unwrap(
        await browserClient().PATCH('/api/v1/auth/me/password', {
          body: {
            currentPassword: String(data.get('currentPassword') ?? ''),
            newPassword,
            newPasswordConfirmation: confirmation,
          },
        }),
      );
      form.reset();
      setMessage({
        kind: 'success',
        text: 'Password berhasil diubah. Anda akan diarahkan untuk login kembali.',
      });
      window.setTimeout(() => window.location.assign('/login'), 1400);
    } catch (caught) {
      setMessage({
        kind: 'error',
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
      });
      setBusy(false);
    }
  }

  return (
    <section className="card profileSection">
      <div className="profileSectionHead">
        <h2>Keamanan akun</h2>
        <p>Gunakan minimal 12 karakter. Semua perangkat akan keluar setelah password berubah.</p>
      </div>
      <form onSubmit={save} className="profileForm">
        <div className="profileGrid">
          <div className="field profileFull">
            <label htmlFor="currentPassword">Password lama</label>
            <PasswordInput id="currentPassword" name="currentPassword" minLength={12} maxLength={128} autoComplete="current-password" required disabled={busy} />
          </div>
          <div className="field">
            <label htmlFor="newPassword">Password baru</label>
            <PasswordInput id="newPassword" name="newPassword" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy} />
          </div>
          <div className="field">
            <label htmlFor="newPasswordConfirmation">Ulangi password baru</label>
            <PasswordInput id="newPasswordConfirmation" name="newPasswordConfirmation" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy} />
          </div>
        </div>
        {message ? <p className={`notice ${message.kind === 'error' ? 'noticeError' : 'noticeSuccess'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
        <div className="profileActions">
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Mengubah…' : 'Ubah password'}</button>
        </div>
      </form>
    </section>
  );
}
