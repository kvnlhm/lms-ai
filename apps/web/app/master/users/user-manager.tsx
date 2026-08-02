'use client';

import type { Schemas } from '@lms/api-client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Plus } from '../../components/icons';
import { Modal } from '../../components/modal';
import { useNotifier } from '../../components/notifier';
import { StatusPill } from '../../components/status-pill';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';

type User = Schemas['AdminUserListItemDto'];

export function UserManager({ users, total }: { users: User[]; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const notifier = useNotifier();
  const [credentialUrl, setCredentialUrl] = useState<string | null>(null);
  const [credentialLabel, setCredentialLabel] = useState('Tautan');
  const [showCreate, setShowCreate] = useState(false);

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
      setShowCreate(false);
    });
  }

  async function suspend(user: User) {
    // Panjang minimum yang sama ditegakkan di API. Dijaga di dalam dialognya
    // supaya Master melihat penyebabnya tanpa kehilangan apa yang sudah
    // diketik, bukan menerima galat validasi setelah alasannya terlanjur
    // terkirim.
    const reason = await notifier.prompt(`Tangguhkan ${user.fullName}?`, {
      text: 'Alasannya tercatat di audit log dan dapat dibaca kembali nanti.',
      label: 'Alasan penangguhan',
      placeholder: 'Misalnya: berbagi akun dengan orang lain',
      multiline: true,
      minLength: 3,
      confirmLabel: 'Tangguhkan',
      danger: true,
    });
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

  async function impersonate(user: User) {
    await run(`impersonate-${user.id}`, async () => {
      unwrap(
        await browserClient().POST('/api/v1/admin/users/{userId}/impersonate', {
          params: { path: { userId: user.id } },
        }),
      );
      window.location.assign('/');
    });
  }

  async function confirmRemoveUser(user: User) {
    const lanjut = await notifier.confirm('Hapus pengguna?', {
      text:
        `Akun ${user.fullName} akan dinonaktifkan, seluruh sesi dicabut, dan data ` +
        'pribadinya dihapus. Histori belajar anonim tetap dipertahankan untuk ' +
        'integritas laporan.',
      confirmLabel: 'Ya, hapus pengguna',
      danger: true,
    });
    if (lanjut) await removeUser(user);
  }

  async function removeUser(user: User) {
    await run(`delete-${user.id}`, async () => {
      unwrap(
        await browserClient().DELETE('/api/v1/admin/users/{userId}', {
          params: { path: { userId: user.id } },
        }),
      );
    });
  }

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await action();
      router.refresh();
    } catch (caught) {
      void notifier.error('Tindakan gagal dijalankan', {
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="userListHead">
        <div>
          <h2>Daftar pengguna</h2>
          <p>{total.toLocaleString('id-ID')} akun ditemukan</p>
        </div>
        <button
          className="btn"
          type="button"
          aria-expanded={showCreate}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={16} />
          Tambah pengguna
        </button>
      </div>

      {showCreate ? (
        <Modal
          title="Undang pengguna baru"
          description="Akun dibuat sebagai Pelajar aktif. Bagikan tautan undangan secara aman."
          busy={busy !== null}
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={create}>
            <div className="userCreateGrid">
              <div className="field">
                <label htmlFor="fullName">Nama lengkap</label>
                <input
                  id="fullName"
                  name="fullName"
                  placeholder="Nama pengguna"
                  required
                  minLength={2}
                  disabled={busy !== null}
                />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nama@contoh.com"
                  required
                  disabled={busy !== null}
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Nomor telepon <span>(opsional)</span></label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+62"
                  disabled={busy !== null}
                />
              </div>
              <div className="field">
                <label htmlFor="newUserRole">Role</label>
                <input id="newUserRole" value="Pelajar" readOnly aria-label="Role pengguna baru" />
              </div>
            </div>
            <div className="userCreateActions">
              <button
                className="btn btnGhost"
                type="button"
                disabled={busy !== null}
                onClick={() => setShowCreate(false)}
              >
                Batal
              </button>
              <button className="btn" type="submit" disabled={busy !== null}>
                {busy === 'create' ? 'Membuat…' : 'Buat undangan'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}


      {credentialUrl ? (
        <div className="notice noticeInfo credentialNotice" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>{credentialLabel} hanya ditampilkan kali ini.</strong>
            <p>Simpan atau bagikan kepada pengguna melalui saluran yang aman.</p>
            <div className="credentialRow">
              <input value={credentialUrl} readOnly aria-label={credentialLabel} />
              <button
                className="btn btnGhost"
                type="button"
                onClick={() => navigator.clipboard.writeText(credentialUrl)}
              >
                Salin tautan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="card userTableCard">
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
                  <td data-label="Pengguna">
                    <span className="userIdentity">
                      <span className="userAvatar" aria-hidden="true">{initials(item.fullName)}</span>
                      <span>
                        <span className="cellTitle">{item.fullName}</span>
                        <span className="cellSub">{item.email}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Role"><span className="roleBadge">{item.role === 'MASTER' ? 'Master' : 'Pelajar'}</span></td>
                  <td data-label="Status"><StatusPill status={item.status} /></td>
                  <td data-label="Login terakhir">{formatDate(item.lastLoginAt)}</td>
                  <td data-label="Bergabung">{formatDate(item.createdAt)}</td>
                  <td className="cellActions">
                    <div className="inlineActions">
                      <button className="btnTiny" type="button" disabled={busy !== null} onClick={() => issuePasswordReset(item)}>
                        Reset password
                      </button>
                      {item.role === 'STUDENT' && item.status === 'ACTIVE' ? (
                        <button className="btnTiny" type="button" disabled={busy !== null} onClick={() => impersonate(item)}>
                          Lihat sebagai
                        </button>
                      ) : null}
                      {item.status === 'SUSPENDED' ? (
                        <button className="btnTiny" type="button" disabled={busy !== null} onClick={() => activate(item)}>
                          Aktifkan
                        </button>
                      ) : (
                        <button className="btnTiny userDangerAction" type="button" disabled={busy !== null} onClick={() => suspend(item)}>
                          Tangguhkan
                        </button>
                      )}
                      {item.role === 'STUDENT' ? (
                        <button className="btnTiny userDangerAction" type="button" disabled={busy !== null} onClick={() => void confirmRemoveUser(item)}>
                          Hapus
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 ? (
            <div className="empty">
              Tidak ada pengguna yang sesuai dengan pencarian atau filter ini.
            </div>
          ) : null}
        </div>
      </section>

    </>
  );
}

function formatDate(value: unknown): string {
  if (!value) return 'Belum pernah';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(String(value)));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
