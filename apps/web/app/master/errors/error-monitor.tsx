'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../components/notifier';
import { ApiError, browserClient, ensureSuccess, unwrap, unwrapList } from '../../lib/browser-api';

/** Bentuknya datang dari OpenAPI, jadi perubahan di API terlihat saat typecheck. */
type ErrorEvent = Schemas['ErrorEventDto'];
type Source = ErrorEvent['source'];
type Status = ErrorEvent['status'];

interface Summary {
  open: number;
  resolved: number;
  lastDay: number;
}

/** Sengaja lebih kecil dari batas lama: sisanya kini dapat dijangkau. */
const UKURAN_HALAMAN = 20;

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
  const notifier = useNotifier();
  const [items, setItems] = useState<ErrorEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<Status | ''>('OPEN');
  const [source, setSource] = useState<Source | ''>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sebelumnya lima puluh galat pertama diperlakukan sebagai seluruhnya.
   * Ringkasan di atas tetap menghitung semuanya, jadi angka "belum ditangani"
   * bisa menyebut lebih banyak daripada yang dapat ditandai selesai — dan
   * sisanya tidak dapat dijangkau untuk ditangani.
   */
  const load = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        const query: Record<string, string | number> = { page, pageSize: UKURAN_HALAMAN };
        if (status) query.status = status;
        if (source) query.source = source;

        const [list, stats] = await Promise.all([
          browserClient().GET('/api/v1/admin/errors', { params: { query } }),
          browserClient().GET('/api/v1/admin/errors/summary', {}),
        ]);

        const hasil = unwrapList<ErrorEvent>(list);
        setItems(hasil.items);
        setHalaman(hasil.meta.page);
        setTotalHalaman(hasil.meta.totalPages);
        setTotal(hasil.meta.total);
        setSummary(unwrap<Summary>(stats));
      } catch (cause) {
        setError(
          cause instanceof ApiError ? cause.message : 'Daftar galat tidak dapat dimuat sekarang.',
        );
      } finally {
        setLoading(false);
      }
    },
    [status, source],
  );

  // Penyaring yang berubah selalu dimulai dari halaman pertama: nomor halaman
  // lama tidak bermakna pada kumpulan hasil yang berbeda.
  useEffect(() => {
    void load(1);
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
      await load(halaman);
    } catch (cause) {
      void notifier.error('Perubahan gagal disimpan', {
        text: cause instanceof ApiError ? cause.message : undefined,
      });
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
        <button
          type="button"
          className="btn btnGhost"
          onClick={() => void load(halaman)}
          disabled={loading}
        >
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
        <div className="card emptyCard">
          <p className="emptyCardTitle">Tidak ada galat pada filter ini.</p>
          <p className="muted emptyCardNote">
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
                  <td data-label="Galat">
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
                  <td data-label="Sumber">{SOURCE_LABEL[item.source]}</td>
                  <td className="num" data-label="Kejadian">{item.occurrences.toLocaleString('id-ID')}</td>
                  <td title={formatDate(item.lastSeenAt)} data-label="Terakhir">{relative(item.lastSeenAt)}</td>
                  <td data-label="Status">
                    <span
                      className={`status ${item.status === 'OPEN' ? 'statusRemoved' : 'statusPublished'}`}
                    >
                      {item.status === 'OPEN' ? 'Terbuka' : 'Selesai'}
                    </span>
                  </td>
                  <td className="cellActions">
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

      {totalHalaman > 1 ? (
        <nav className="toolbar enrollmentPager" aria-label="Navigasi halaman galat">
          <button
            className="btn btnGhost"
            type="button"
            disabled={halaman <= 1 || loading}
            onClick={() => void load(halaman - 1)}
          >
            Sebelumnya
          </button>
          <span className="pill">
            Halaman {halaman} dari {totalHalaman} · {total} galat
          </span>
          <button
            className="btn btnGhost"
            type="button"
            disabled={halaman >= totalHalaman || loading}
            onClick={() => void load(halaman + 1)}
          >
            Berikutnya
          </button>
        </nav>
      ) : null}
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
