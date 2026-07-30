'use client';

import type { Schemas } from '@lms/api-client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ApiError,
  browserApiUrl,
  browserClient,
  ensureSuccess,
  readCsrfToken,
  unwrap,
} from '../lib/browser-api';

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
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({ kind: 'error', text: 'Pilih foto JPEG, PNG, atau WebP.' });
      event.target.value = '';
      return;
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      setMessage({ kind: 'error', text: 'Ukuran foto maksimal 5 MB.' });
      event.target.value = '';
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl(nextPreview);
    setAvatarBusy(true);
    setAvatarProgress(0);
    setMessage(null);

    const request = new XMLHttpRequest();
    request.open('PUT', `${browserApiUrl()}/api/v1/auth/me/avatar`);
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', file.type);
    const csrf = readCsrfToken();
    if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);
    request.upload.onprogress = (progress) => {
      if (progress.lengthComputable) {
        setAvatarProgress(Math.round((progress.loaded / progress.total) * 100));
      }
    };
    request.onload = () => {
      setAvatarBusy(false);
      setAvatarProgress(null);
      event.target.value = '';
      if (request.status >= 200 && request.status < 300) {
        try {
          const payload = JSON.parse(request.responseText) as { data?: { avatarUrl?: string } };
          setAvatarUrl(payload.data?.avatarUrl ?? nextPreview);
        } catch {
          setAvatarUrl(nextPreview);
        }
        setMessage({ kind: 'success', text: 'Foto profil berhasil diperbarui.' });
        router.refresh();
        return;
      }
      setPreviewUrl(null);
      setMessage({ kind: 'error', text: apiMessage(request.responseText) });
    };
    request.onerror = () => {
      setAvatarBusy(false);
      setAvatarProgress(null);
      setPreviewUrl(null);
      event.target.value = '';
      setMessage({ kind: 'error', text: 'Tidak dapat menghubungi server.' });
    };
    request.send(file);
  }

  async function removeAvatar() {
    if (avatarBusy || !avatarUrl) return;
    setAvatarBusy(true);
    setMessage(null);
    try {
      ensureSuccess(await browserClient().DELETE('/api/v1/auth/me/avatar', {}));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setAvatarUrl(null);
      setMessage({ kind: 'success', text: 'Foto profil berhasil dihapus.' });
      router.refresh();
    } catch (caught) {
      setMessage({
        kind: 'error',
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
      });
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className="card profileCard">
      <div className="profileIdentity">
        <span className="profileAvatar">
          {previewUrl || avatarUrl ? (
            <img src={previewUrl ?? avatarUrl ?? ''} alt={`Foto profil ${user.fullName}`} />
          ) : (
            <span aria-hidden="true">{initials(user.fullName)}</span>
          )}
        </span>
        <div>
          <h2>{user.fullName}</h2>
          <p>{user.email}</p>
          <span className="roleBadge">{user.role === 'MASTER' ? 'Master' : 'Pelajar'}</span>
          <div className="avatarActions">
            <input
              ref={fileInput}
              className="srOnly"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={chooseAvatar}
              disabled={avatarBusy}
              aria-label="Pilih foto profil"
            />
            <button className="btnTiny" type="button" disabled={avatarBusy} onClick={() => fileInput.current?.click()}>
              {avatarBusy ? 'Mengunggah…' : avatarUrl ? 'Ganti foto' : 'Unggah foto'}
            </button>
            {avatarUrl ? (
              <button className="btnTiny avatarRemove" type="button" disabled={avatarBusy} onClick={removeAvatar}>
                Hapus
              </button>
            ) : null}
          </div>
          {avatarProgress !== null ? (
            <div className="avatarProgress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avatarProgress}>
              <span style={{ width: `${avatarProgress}%` }} />
            </div>
          ) : null}
          <small>JPEG, PNG, atau WebP · maksimal 5 MB</small>
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

function apiMessage(responseText: string): string {
  try {
    const payload = JSON.parse(responseText) as { error?: { message?: string; fields?: Record<string, string[]> } };
    return payload.error?.fields?.file?.[0] ?? payload.error?.message ?? 'Upload foto gagal.';
  } catch {
    return 'Upload foto gagal.';
  }
}
