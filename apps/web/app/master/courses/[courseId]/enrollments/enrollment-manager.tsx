'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrap } from '../../../../lib/browser-api';
import { StatusPill } from '../../../../components/status-pill';

type Enrollment = Schemas['AdminEnrollmentDto'];
type GrantResult = Schemas['GrantResultDto'];

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
  const [userIds, setUserIds] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GrantResult[] | null>(null);

  async function run(action: string, fn: () => Promise<unknown>): Promise<void> {
    if (busy) return;
    setBusy(action);
    setError(null);

    try {
      await fn();
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Tidak dapat menghubungi server. Perubahan belum tersimpan.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ids = userIds
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (ids.length === 0) return;

    setResults(null);
    await run('grant', async () => {
      const response = unwrap(
        await browserClient().POST('/api/v1/admin/courses/{courseId}/enrollments', {
          params: { path: { courseId } },
          body: { userIds: ids },
        }),
      );
      // Hasil ditampilkan per pengguna: satu ID yang salah tidak membatalkan
      // pendaftaran yang lain, jadi Master perlu melihat rinciannya.
      setResults(response.results);
      setUserIds('');
    });
  }

  const revoke = (enrollmentId: string) =>
    run(`revoke-${enrollmentId}`, async () =>
      unwrap(
        await browserClient().POST('/api/v1/admin/enrollments/{enrollmentId}/remove', {
          params: { path: { enrollmentId } },
        }),
      ),
    );

  const reactivate = (enrollmentId: string) =>
    run(`reactivate-${enrollmentId}`, async () =>
      unwrap(
        await browserClient().POST('/api/v1/admin/enrollments/{enrollmentId}/reactivate', {
          params: { path: { enrollmentId } },
        }),
      ),
    );

  return (
    <>
      {error ? (
        <p className="notice noticeError" role="alert" style={{ marginBottom: 18 }}>
          {error}
        </p>
      ) : null}

      <section className="card panel" style={{ marginBottom: 20 }}>
        <div className="panelHead">
          <h2>Beri akses</h2>
        </div>
        <form onSubmit={grant}>
          <div className="field">
            <label htmlFor="userIds">ID pengguna</label>
            <textarea
              id="userIds"
              value={userIds}
              onChange={(event) => setUserIds(event.target.value)}
              placeholder="Tempel satu atau beberapa UUID, dipisah baris baru atau koma"
              disabled={busy !== null}
              aria-describedby="userIds-help"
            />
            <span className="fieldError" id="userIds-help" style={{ color: 'var(--muted)' }}>
              Pencarian pengguna belum tersedia; sementara ini akses diberikan
              berdasarkan ID.
            </span>
          </div>
          <button className="btn" type="submit" disabled={busy !== null || userIds.trim() === ''}>
            {busy === 'grant' ? 'Memproses…' : 'Beri akses'}
          </button>
        </form>

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
                  <th>Terakhir aktif</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>
                      <span className="cellTitle">{enrollment.user.fullName}</span>
                      <span className="cellSub">{enrollment.user.email}</span>
                    </td>
                    <td>
                      <StatusPill status={enrollment.status} />
                    </td>
                    <td>
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
                    <td>{formatRelative(enrollment.progress.lastActivityAt ?? null)}</td>
                    <td className="num">
                      {enrollment.status === 'REMOVED' || enrollment.status === 'EXPIRED' ? (
                        <button
                          className="btnTiny"
                          onClick={() => reactivate(enrollment.id)}
                          disabled={busy !== null}
                        >
                          Aktifkan
                        </button>
                      ) : (
                        <button
                          className="btnTiny btnDanger"
                          onClick={() => revoke(enrollment.id)}
                          disabled={busy !== null}
                        >
                          Cabut akses
                        </button>
                      )}
                    </td>
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

function formatRelative(value: string | null): string {
  if (!value) return 'Belum pernah';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  return `${days} hari lalu`;
}
