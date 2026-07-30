'use client';

import type { Schemas } from '@lms/api-client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

type User = Schemas['CurrentUserResponseDto'];

function initials(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export function ProfileForm({ user }: { user: User }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      unwrap(
        await browserClient().PATCH('/api/v1/auth/me', {
          body: {
            fullName: String(form.get('fullName') ?? ''),
            phone: String(form.get('phone') ?? '') || null,
            bio: String(form.get('bio') ?? '') || null,
          },
        }),
      );
      setMessage({ kind: 'success', text: 'Profil berhasil diperbarui.' });
      router.refresh();
    } catch (caught) {
      setMessage({
        kind: 'error',
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card profileCard">
      <div className="profileIdentity">
        <span className="profileAvatar" aria-hidden="true">{initials(user.fullName)}</span>
        <div>
          <h2>{user.fullName}</h2>
          <p>{user.email}</p>
          <span className="roleBadge">{user.role === 'MASTER' ? 'Master' : 'Pelajar'}</span>
        </div>
      </div>

      <form onSubmit={save} className="profileForm">
        <div className="profileGrid">
          <div className="field">
            <label htmlFor="profileFullName">Nama lengkap</label>
            <input
              id="profileFullName"
              name="fullName"
              defaultValue={user.fullName}
              minLength={2}
              maxLength={120}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="profilePhone">Nomor telepon <span>(opsional)</span></label>
            <input
              id="profilePhone"
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ''}
              maxLength={30}
              placeholder="+62"
              disabled={busy}
            />
          </div>
          <div className="field profileFull">
            <label htmlFor="profileEmail">Email</label>
            <input id="profileEmail" value={user.email} readOnly aria-describedby="emailHelp" />
            <small id="emailHelp">Email akun tidak dapat diubah dari halaman profil.</small>
          </div>
          <div className="field profileFull">
            <label htmlFor="profileBio">Bio singkat <span>(opsional)</span></label>
            <textarea
              id="profileBio"
              name="bio"
              defaultValue={user.bio ?? ''}
              maxLength={500}
              rows={5}
              placeholder="Ceritakan sedikit tentang diri Anda…"
              disabled={busy}
            />
          </div>
        </div>

        {message ? (
          <p className={`notice ${message.kind === 'error' ? 'noticeError' : 'noticeSuccess'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        ) : null}

        <div className="profileActions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
        </div>
      </form>
    </section>
  );
}
