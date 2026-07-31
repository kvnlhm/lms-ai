'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, browserClient, ensureSuccess, unwrap } from '../../lib/browser-api';

type Source = 'API' | 'WEB' | 'WORKER';
type Status = 'OPEN' | 'RESOLVED';

interface ErrorEvent {
  id: string;
  fingerprint: string;
  source: Source;
  status: Status;
  type: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

interface Summary {
  open: number;
  resolved: number;
  lastDay: number;
}

const SOURCE_LABEL: Record<Source, string> = {
  API: 'API',
  WEB: 'Browser',
  WORKER: 'Worker',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Jarak waktu yang lebih cepat dibaca daripada tanggal penuh saat memindai daftar. */
function relative(value: string): string {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'baru saja';
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} jam lalu`;
  return `${Math.floor(seconds / 86_400)} hari lalu`;
}

export function ErrorMonitor() {
  const [items, setItems] = useState<ErrorEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<Status | ''>('OPEN');
  const [source, setSource] = useState<Source | ''>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number> = { page: 1, pageSize: 50 };
      if (status) query.status = status;
      if (source) query.source = source;

      const [list, stats] = await Promise.all([
        browserClient().GET('/api/v1/admin/errors', { params: { query } }),
        browserClient().GET('/api/v1/admin/errors/summary', {}),
      ]);

      setItems(unwrap(list) as unknown as ErrorEvent[]);
      setSummary(unwrap(stats) as unknown as Summary);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Daftar galat tidak dapat dimuat sekarang.',
      );
    } finally {
      setLoading(false);
    }
  }, [status, source]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: 'resolve' | 'reopen') => {
    setBusy(id);
    setError(null);
    try {
      ensureSuccess(
        await browserClient().POST(`/api/v1/admin/errors/{errorId}/${action}` as never, {
          params: { path: { errorId: id } },
        } as never),
      );
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Perubahan gagal disimpan.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {summary ? (
        <div className="metricGrid" style={{ marginBottom: 22 }}>
          <div className="card metricCard">
            <span>Belum ditangani</span>
            <strong>{summary.open}</strong>
            <small>Jenis galat yang masih terbuka</small>
          </div>
          <div className="card metricCard">
            <span>Terlihat 24 jam terakhir</span>
            <strong>{summary.lastDay}</strong>
            <small>Termasuk yang sudah ditandai selesai</small>
          </div>
          <div className="card metricCard">
            <span>Sudah ditangani</span>
            <strong>{summary.resolved}</strong>
            <small>Akan terbuka lagi bila terulang</small>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <label className="field errorFilter">
          <span className="srOnly">Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as Status | '')}>
            <option value="OPEN">Belum ditangani</option>
            <option value="RESOLVED">Sudah ditangani</option>
            <option value="">Semua status</option>
          </select>
        </label>
        <label className="field errorFilter">
          <span className="srOnly">Sumber</span>
          <select value={source} onChange={(event) => setSource(event.target.value as Source | '')}>
            <option value="">Semua sumber</option>
            <option value="API">API</option>
            <option value="WEB">Browser</option>
            <option value="WORKER">Worker</option>
          </select>
        </label>
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
        <p className="muted">Memuat daftar galat…</p>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Tidak ada galat pada filter ini.</p>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Daftar kosong berarti belum ada kegagalan yang tercatat — bukan berarti pemantauannya
            mati.
          </p>
        </div>
      ) : (
        <div className="card tableWrap">
          <table className="data">
            <thead>
              <tr>
                <th>Galat</th>
                <th>Sumber</th>
                <th className="num">Kejadian</th>
                <th>Terakhir</th>
                <th>Status</th>
                <th aria-label="Tindakan" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="errorToggle"
                      onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      aria-expanded={expanded === item.id}
                    >
                      <span className="cellTitle">{item.type}</span>
                    </button>
                    <span className="cellSub">{item.message}</span>
                    {expanded === item.id ? (
                      <div className="errorDetail">
                        <dl>
                          <dt>Pertama terlihat</dt>
                          <dd>{formatDate(item.firstSeenAt)}</dd>
                          <dt>Terakhir terlihat</dt>
                          <dd>{formatDate(item.lastSeenAt)}</dd>
                          {item.context && typeof item.context === 'object'
                            ? Object.entries(item.context)
                                .filter(([, value]) => value !== null && value !== undefined)
                                .map(([key, value]) => (
                                  <ErrorContextRow key={key} label={key} value={value} />
                                ))
                            : null}
                        </dl>
                        {item.stack ? <pre className="errorStack">{item.stack}</pre> : null}
                      </div>
                    ) : null}
                  </td>
                  <td>{SOURCE_LABEL[item.source]}</td>
                  <td className="num">{item.occurrences.toLocaleString('id-ID')}</td>
                  <td title={formatDate(item.lastSeenAt)}>{relative(item.lastSeenAt)}</td>
                  <td>
                    <span
                      className={`status ${item.status === 'OPEN' ? 'statusRemoved' : 'statusPublished'}`}
                    >
                      {item.status === 'OPEN' ? 'Terbuka' : 'Selesai'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btnTiny"
                      disabled={busy === item.id}
                      onClick={() =>
                        void act(item.id, item.status === 'OPEN' ? 'resolve' : 'reopen')
                      }
                    >
                      {busy === item.id
                        ? 'Menyimpan…'
                        : item.status === 'OPEN'
                          ? 'Tandai selesai'
                          : 'Buka lagi'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const CONTEXT_LABEL: Record<string, string> = {
  method: 'Metode',
  path: 'Rute',
  statusCode: 'Status HTTP',
  requestId: 'Request ID',
  userId: 'Pengguna',
  queue: 'Antrean',
  jobName: 'Nama job',
};

function ErrorContextRow({ label, value }: { label: string; value: unknown }) {
  return (
    <>
      <dt>{CONTEXT_LABEL[label] ?? label}</dt>
      <dd>
        <code>{typeof value === 'string' ? value : JSON.stringify(value)}</code>
      </dd>
    </>
  );
}
