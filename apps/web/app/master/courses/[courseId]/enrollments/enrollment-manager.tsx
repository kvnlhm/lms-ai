'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrap } from '../../../../lib/browser-api';
import { Modal } from '../../../../components/modal';
import { useNotifier } from '../../../../components/notifier';
import { StatusPill } from '../../../../components/status-pill';

type Enrollment = Schemas['AdminEnrollmentDto'];
type GrantResult = Schemas['GrantResultDto'];
type User = Schemas['AdminUserListItemDto'];

const OUTCOME_LABELS: Record<string, string> = {
  ENROLLED: 'didaftarkan',
  REACTIVATED: 'diaktifkan kembali',
  ALREADY_ENROLLED: 'sudah terdaftar',
  USER_NOT_FOUND: 'pengguna tidak ditemukan',
  USER_INACTIVE: 'akun tidak aktif',
};

export function EnrollmentManager({
  courseId,
  enrollments,
}: {
  courseId: string;
  enrollments: Enrollment[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const notifier = useNotifier();
  const [grantOpen, setGrantOpen] = useState(false);
  const [results, setResults] = useState<GrantResult[] | null>(null);

  async function run(action: string, fn: () => Promise<unknown>): Promise<void> {
    if (busy) return;
    setBusy(action);

    try {
      await fn();
      router.refresh();
    } catch (caught) {
      void notifier.error('Perubahan belum tersimpan', {
        text:
          caught instanceof ApiError
            ? caught.message
            : 'Tidak dapat menghubungi server. Periksa koneksimu lalu coba lagi.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedIds.length === 0) return;

    setResults(null);
    await run('grant', async () => {
      const response = unwrap(
        await browserClient().POST('/api/v1/admin/courses/{courseId}/enrollments', {
          params: { path: { courseId } },
          body: { userIds: selectedIds },
        }),
      );
      // Hasil ditampilkan per pengguna: satu ID yang salah tidak membatalkan
      // pendaftaran yang lain, jadi Master perlu melihat rinciannya.
      // Hasilnya dirender di luar modal, jadi tetap terbaca setelah modalnya
      // menutup — dan memang perlu dibaca: satu ID yang gagal tidak
      // membatalkan yang lain.
      setResults(response.results);
      setSelectedIds([]);
      setMatches([]);
      setSearch('');
      setGrantOpen(false);
    });
  }

  async function findUsers(): Promise<void> {
    const term = search.trim();
    if (term.length < 2) {
      void notifier.error('Kata kunci terlalu pendek', {
        text: 'Ketik minimal 2 karakter nama atau email.',
      });
      return;
    }
    await run('search', async () => {
      const users = unwrap(
        await browserClient().GET('/api/v1/admin/users', {
          params: { query: { page: 1, pageSize: 20, search: term, role: 'STUDENT', status: 'ACTIVE' } },
        }),
      ) as User[];
      const enrolled = new Set(enrollments.map((item) => item.user.id));
      setMatches(users.filter((item) => !enrolled.has(item.id)));
    });
  }

  return (
    <>
      <section className="card panel" style={{ marginBottom: 20 }}>
        <div className="panelHead">
          <h2>Beri akses</h2>
          <button className="btn" type="button" disabled={busy !== null} onClick={() => setGrantOpen(true)}>
            Beri akses pelajar
          </button>
        </div>

        {grantOpen ? (
          <Modal
            title="Beri akses pelajar"
            description="Cari pelajar, pilih yang ingin didaftarkan, lalu beri akses."
            busy={busy !== null}
            onClose={() => setGrantOpen(false)}
          >
        <form onSubmit={grant}>
          <div className="field">
            <label htmlFor="userSearch">Cari Pelajar</label>
            <div className="inlineActions">
              <input
                id="userSearch"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nama atau email Pelajar"
                disabled={busy !== null}
              />
              <button className="btn btnGhost" type="button" onClick={findUsers} disabled={busy !== null}>
                {busy === 'search' ? 'Mencari…' : 'Cari'}
              </button>
            </div>
          </div>

          {matches.length > 0 ? (
            <div className="card" style={{ padding: 12, marginBottom: 14 }}>
              {matches.map((item) => (
                <label key={item.id} style={{ display: 'flex', gap: 10, padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span>
                    <span className="cellTitle">{item.fullName}</span>
                    <span className="cellSub">{item.email}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="lessonEditActions">
            <button className="btn btnGhost" type="button" disabled={busy !== null} onClick={() => setGrantOpen(false)}>
              Batal
            </button>
            <button className="btn" type="submit" disabled={busy !== null || selectedIds.length === 0}>
              {busy === 'grant' ? 'Memproses…' : 'Beri akses'}
            </button>
          </div>
        </form>
          </Modal>
        ) : null}

        {results ? (
          <div style={{ marginTop: 18 }}>
            <h3 className="eyebrow" style={{ marginBottom: 8 }}>
              Hasil
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
              {results.map((result) => (
                <li key={result.userId} style={{ marginTop: 4 }}>
                  <code style={{ color: 'var(--text-2)' }}>{result.userId.slice(0, 8)}…</code>{' '}
                  {OUTCOME_LABELS[result.outcome] ?? result.outcome}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {enrollments.length === 0 ? (
        <div className="card empty">
          <p style={{ margin: 0 }}>Belum ada pelajar pada kursus ini.</p>
        </div>
      ) : (
        <section className="card" style={{ padding: '6px 0' }}>
          <div className="tableWrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Pelajar</th>
                  <th>Status</th>
                  <th>Progres</th>
                  <th>Bergabung</th>
                  <th>Terakhir aktif</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td data-label="Pelajar">
                      <span className="cellTitle">{enrollment.user.fullName}</span>
                      <span className="cellSub">{enrollment.user.email}</span>
                    </td>
                    <td data-label="Status">
                      <StatusPill status={enrollment.status} />
                    </td>
                    <td data-label="Progres">
                      <span
                        className="miniTrack"
                        role="img"
                        aria-label={`Progres ${enrollment.progress.percent} persen`}
                      >
                        <span
                          className="miniFill"
                          style={{ width: `${enrollment.progress.percent}%` }}
                        />
                      </span>
                      <span className="num" style={{ marginLeft: 8, fontWeight: 600 }}>
                        {enrollment.progress.percent}%
                      </span>
                      <span className="cellSub">
                        {enrollment.progress.requiredLessonsCompleted} dari{' '}
                        {enrollment.progress.requiredLessonsTotal} pelajaran wajib
                      </span>
                    </td>
                    {/* Kapan seseorang bergabung dan kapan ia menyelesaikan
                        kursus sudah lama ikut terkirim, tetapi tidak pernah
                        ditampilkan — padahal itulah dua tanggal yang dicari
                        saat menakar apakah seorang peserta tertinggal. */}
                    <td data-label="Bergabung">
                      <span>{formatTanggal(enrollment.enrolledAt)}</span>
                      {enrollment.completedAt ? (
                        <span className="cellSub">Selesai {formatTanggal(enrollment.completedAt)}</span>
                      ) : null}
                    </td>
                    <td data-label="Terakhir aktif">{formatRelative(enrollment.progress.lastActivityAt ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function formatTanggal(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

function formatRelative(value: string | null): string {
  if (!value) return 'Belum pernah';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  return `${days} hari lalu`;
}
