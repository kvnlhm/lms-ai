'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';

interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actor: { id: string; fullName: string; email: string } | null;
  beforeData: unknown;
  afterData: unknown;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const PAGE_SIZE = 25;

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
}

/** `datetime-local` menuntut waktu lokal tanpa zona. */
function toLocalInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AuditLogBrowser() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await browserClient().GET('/api/v1/admin/audit-logs/actions', {});
        setActions((unwrap(response) as unknown as { actions: string[] }).actions);
      } catch {
        // Penyaring kehilangan pilihannya, tetapi daftarnya tetap dapat dibaca.
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
      if (action) query.action = action;
      if (from) query.from = new Date(from).toISOString();
      if (to) query.to = new Date(to).toISOString();

      const response = await browserClient().GET('/api/v1/admin/audit-logs', {
        params: { query },
      });
      setItems(unwrap(response) as unknown as AuditEntry[]);
      const meta = (response as { data?: { meta?: { totalPages?: number; total?: number } } }).data
        ?.meta;
      setTotalPages(meta?.totalPages ?? 1);
      setTotal(meta?.total ?? 0);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Audit log tidak dapat dimuat sekarang.');
    } finally {
      setLoading(false);
    }
  }, [action, from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilter = (next: () => void) => {
    // Menyaring selalu kembali ke halaman pertama; kalau tidak, hasil sedikit
    // pada halaman 5 akan tampak kosong tanpa penjelasan.
    setPage(1);
    next();
  };

  return (
    <>
      <div className="toolbar">
        <label className="field errorFilter">
          <span className="srOnly">Jenis tindakan</span>
          <select
            value={action}
            onChange={(event) => applyFilter(() => setAction(event.target.value))}
          >
            <option value="">Semua tindakan</option>
            {actions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field errorFilter">
          <span className="srOnly">Dari</span>
          <input
            type="datetime-local"
            value={from}
            max={to || toLocalInputValue(new Date())}
            onChange={(event) => applyFilter(() => setFrom(event.target.value))}
          />
        </label>
        <label className="field errorFilter">
          <span className="srOnly">Sampai</span>
          <input
            type="datetime-local"
            value={to}
            min={from || undefined}
            onChange={(event) => applyFilter(() => setTo(event.target.value))}
          />
        </label>
        {action || from || to ? (
          <button
            type="button"
            className="btnTiny"
            onClick={() =>
              applyFilter(() => {
                setAction('');
                setFrom('');
                setTo('');
              })
            }
          >
            Reset penyaring
          </button>
        ) : null}
        <button type="button" className="btn btnGhost" onClick={() => void load()} disabled={loading}>
          {loading ? 'Memuat…' : 'Muat ulang'}
        </button>
      </div>

      {error ? (
        <p className="notice noticeError" role="alert">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="muted">Memuat audit log…</p>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Tidak ada catatan pada penyaring ini.</p>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>
            {total.toLocaleString('id-ID')} catatan.
          </p>
          <div className="card tableWrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pelaku</th>
                  <th>Tindakan</th>
                  <th>Target</th>
                  <th>Asal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap' }} data-label="Waktu">{formatDate(entry.createdAt)}</td>
                    <td data-label="Pelaku">
                      {entry.actor ? (
                        <>
                          <span className="cellTitle">{entry.actor.fullName}</span>
                          <span className="cellSub">{entry.actor.email}</span>
                        </>
                      ) : (
                        // Aktor memakai ON DELETE SET NULL: catatannya bertahan
                        // walau akun pelakunya sudah dihapus.
                        <span className="muted">Akun sudah dihapus</span>
                      )}
                    </td>
                    <td data-label="Tindakan">
                      <button
                        type="button"
                        className="errorToggle"
                        onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                        aria-expanded={expanded === entry.id}
                      >
                        <span className="cellTitle">{entry.action}</span>
                      </button>
                      {expanded === entry.id ? (
                        <div className="errorDetail">
                          <dl>
                            {entry.requestId ? (
                              <>
                                <dt>Request ID</dt>
                                <dd>
                                  <code>{entry.requestId}</code>
                                </dd>
                              </>
                            ) : null}
                            {entry.userAgent ? (
                              <>
                                <dt>User agent</dt>
                                <dd>{entry.userAgent}</dd>
                              </>
                            ) : null}
                          </dl>
                          {entry.beforeData ? (
                            <>
                              <p className="auditDiffLabel">Sebelum</p>
                              <pre className="errorStack">
                                {JSON.stringify(entry.beforeData, null, 2)}
                              </pre>
                            </>
                          ) : null}
                          {entry.afterData ? (
                            <>
                              <p className="auditDiffLabel">Sesudah</p>
                              <pre className="errorStack">
                                {JSON.stringify(entry.afterData, null, 2)}
                              </pre>
                            </>
                          ) : null}
                          {!entry.beforeData && !entry.afterData ? (
                            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                              Tindakan ini tidak menyimpan cuplikan data.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Target">
                      <span className="cellTitle">{entry.targetType}</span>
                      {entry.targetId ? <span className="cellSub">{entry.targetId}</span> : null}
                    </td>
                    <td data-label="Asal">{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav aria-label="Navigasi halaman" className="toolbar" style={{ justifyContent: 'center', marginTop: 18 }}>
              <button
                type="button"
                className="btn btnGhost"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Sebelumnya
              </button>
              <span className="muted" style={{ alignSelf: 'center' }}>
                Halaman {page} dari {totalPages}
              </span>
              <button
                type="button"
                className="btn btnGhost"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Berikutnya
              </button>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
