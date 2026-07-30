'use client';

import type { Schemas } from '@lms/api-client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';

type User = Schemas['AdminUserListItemDto'];

export function UserManager({ users }: { users: User[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentialUrl, setCredentialUrl] = useState<string | null>(null);
  const [credentialLabel, setCredentialLabel] = useState('Tautan');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run('create', async () => {
      const created = unwrap(
        await browserClient().POST('/api/v1/admin/users', {
          body: {
            fullName: String(form.get('fullName') ?? ''),
            email: String(form.get('email') ?? ''),
            phone: String(form.get('phone') ?? '') || null,
            role: 'STUDENT',
            status: 'ACTIVE',
          },
        }),
      );
      setCredentialLabel('Tautan undangan');
      setCredentialUrl(
        `${window.location.origin}/accept-invitation?token=${encodeURIComponent(created.invitationToken)}`,
      );
      event.currentTarget.reset();
    });
  }

  async function suspend(user: User) {
    const reason = window.prompt(`Alasan menangguhkan ${user.fullName}:`);
    if (!reason) return;
    await run(user.id, async () => {
      unwrap(
        await browserClient().POST('/api/v1/admin/users/{userId}/suspend', {
          params: { path: { userId: user.id } },
          body: { reason },
        }),
      );
    });
  }

  async function activate(user: User) {
    await run(user.id, async () => {
      unwrap(
        await browserClient().POST('/api/v1/admin/users/{userId}/activate', {
          params: { path: { userId: user.id } },
        }),
      );
    });
  }

  async function issuePasswordReset(user: User) {
    await run(`password-${user.id}`, async () => {
      const result = unwrap(
        await browserClient().POST('/api/v1/admin/users/{userId}/password-reset-link', {
          params: { path: { userId: user.id } },
        }),
      );
      setCredentialLabel(`Tautan reset password untuk ${user.fullName}`);
      setCredentialUrl(
        `${window.location.origin}/reset-password?token=${encodeURIComponent(result.token)}`,
      );
    });
  }

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="sectionTitle">Tambah pengguna</h2>
        <form onSubmit={create}>
          <div className="formGrid">
            <div className="field">
              <label htmlFor="fullName">Nama lengkap</label>
              <input id="fullName" name="fullName" required minLength={2} disabled={busy !== null} />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required disabled={busy !== null} />
            </div>
            <div className="field">
              <label htmlFor="phone">Nomor telepon (opsional)</label>
              <input id="phone" name="phone" disabled={busy !== null} />
            </div>
            <div className="field">
              <label>Role</label>
              <input value="Pelajar" readOnly aria-label="Role pengguna baru" />
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy !== null}>
            {busy === 'create' ? 'Membuat…' : 'Buat dan terbitkan undangan'}
          </button>
        </form>
        {error ? <p className="fieldError" role="alert">{error}</p> : null}
        {credentialUrl ? (
          <div className="notice" role="status" style={{ marginTop: 14 }}>
            <strong>{credentialLabel} hanya ditampilkan kali ini.</strong>
            <input value={credentialUrl} readOnly aria-label={credentialLabel} />
            <button className="btn btnGhost" type="button" onClick={() => navigator.clipboard.writeText(credentialUrl)}>
              Salin tautan
            </button>
          </div>
        ) : null}
      </section>

      <section className="card" style={{ padding: '6px 0' }}>
        <div className="tableWrap">
          <table className="data">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Role</th>
                <th>Status</th>
                <th>Login terakhir</th>
                <th>Bergabung</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="cellTitle">{item.fullName}</span>
                    <span className="cellSub">{item.email}</span>
                  </td>
                  <td>{item.role === 'MASTER' ? 'Master' : 'Pelajar'}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td>{formatDate(item.lastLoginAt)}</td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="inlineActions">
                      <button className="btn btnGhost" type="button" disabled={busy !== null} onClick={() => issuePasswordReset(item)}>
                        Reset password
                      </button>
                      {item.status === 'SUSPENDED' ? (
                        <button className="btn btnGhost" type="button" disabled={busy !== null} onClick={() => activate(item)}>
                          Aktifkan
                        </button>
                      ) : (
                        <button className="btn btnDanger" type="button" disabled={busy !== null} onClick={() => suspend(item)}>
                          Tangguhkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function statusLabel(status: string): string {
  return { ACTIVE: 'Aktif', INACTIVE: 'Tidak aktif', SUSPENDED: 'Ditangguhkan' }[status] ?? status;
}

function formatDate(value: unknown): string {
  if (!value) return 'Belum pernah';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(String(value)));
}
