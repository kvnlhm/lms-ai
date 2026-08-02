'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrap, unwrapList } from '../../lib/browser-api';

/** Bentuknya datang dari OpenAPI, jadi perubahan di API terlihat saat typecheck. */
type AuditEntry = Schemas['AuditLogEntryDto'];

const PAGE_SIZE = 25;

interface Penyaring {
  /** Dicocokkan sebagai awalan oleh server, jadi `user.` menyaring segolongan. */
  action: string;
  actorUserId: string;
  actorLabel: string;
  targetType: string;
  targetId: string;
  from: string;
  to: string;
}

const TANPA_PENYARING: Penyaring = {
  action: '',
  actorUserId: '',
  actorLabel: '',
  targetType: '',
  targetId: '',
  from: '',
  to: '',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
}

/** `datetime-local` menuntut waktu lokal tanpa zona. */
function toLocalInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Mengelompokkan tindakan menurut awalannya, mis. `user.` atau `course.`.
 *
 * Server mencocokkan `action` sebagai awalan, bukan sebagai nilai penuh —
 * kemampuan yang selama ini tidak pernah dapat dijangkau dari halaman ini
 * karena daftarnya hanya menawarkan nilai-nilai persis. Tiap kelompok kini
 * mendapat satu pilihan "semua" yang memakai awalan itu.
 */
function kelompokkan(actions: string[]): Array<{ awalan: string; daftar: string[] }> {
  const peta = new Map<string, string[]>();
  for (const action of actions) {
    const titik = action.indexOf('.');
    const awalan = titik > 0 ? `${action.slice(0, titik)}.` : '';
    const daftar = peta.get(awalan);
    if (daftar) daftar.push(action);
    else peta.set(awalan, [action]);
  }
  return [...peta.entries()]
    .map(([awalan, daftar]) => ({ awalan, daftar }))
    .sort((a, b) => a.awalan.localeCompare(b.awalan));
}

export function AuditLogBrowser() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [penyaring, setPenyaring] = useState<Penyaring>(TANPA_PENYARING);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = unwrap<Schemas['AuditLogActionsDto']>(
          await browserClient().GET('/api/v1/admin/audit-logs/actions', {}),
        );
        setActions(data.actions);
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
      if (penyaring.action) query.action = penyaring.action;
      if (penyaring.actorUserId) query.actorUserId = penyaring.actorUserId;
      if (penyaring.targetType) query.targetType = penyaring.targetType;
      if (penyaring.targetId) query.targetId = penyaring.targetId;
      if (penyaring.from) query.from = new Date(penyaring.from).toISOString();
      if (penyaring.to) query.to = new Date(penyaring.to).toISOString();

      const { items: batch, meta } = unwrapList<AuditEntry>(
        await browserClient().GET('/api/v1/admin/audit-logs', { params: { query } }),
      );
      setItems(batch);
      setTotalPages(meta.totalPages);
      setTotal(meta.total);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Audit log tidak dapat dimuat sekarang.');
    } finally {
      setLoading(false);
    }
  }, [penyaring, page]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Menyaring selalu kembali ke halaman pertama; kalau tidak, hasil sedikit
   * pada halaman 5 akan tampak kosong tanpa penjelasan.
   */
  const saring = useCallback((patch: Partial<Penyaring>) => {
    setPage(1);
    setPenyaring((current) => ({ ...current, ...patch }));
  }, []);

  const kelompok = useMemo(() => kelompokkan(actions), [actions]);
  const adaPenyaring =
    penyaring.action !== '' ||
    penyaring.actorUserId !== '' ||
    penyaring.targetType !== '' ||
    penyaring.from !== '' ||
    penyaring.to !== '';

  return (
    <>
      <div className="toolbar">
        <label className="field errorFilter">
          <span className="srOnly">Jenis tindakan</span>
          <select
            value={penyaring.action}
            onChange={(event) => saring({ action: event.target.value })}
          >
            <option value="">Semua tindakan</option>
            {kelompok.map(({ awalan, daftar }) => (
              <optgroup key={awalan || 'lainnya'} label={awalan || 'Lainnya'}>
                {awalan ? <option value={awalan}>Semua {awalan}…</option> : null}
                {daftar.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field errorFilter">
          <span className="srOnly">Dari</span>
          <input
            type="datetime-local"
            value={penyaring.from}
            max={penyaring.to || toLocalInputValue(new Date())}
            onChange={(event) => saring({ from: event.target.value })}
          />
        </label>
        <label className="field errorFilter">
          <span className="srOnly">Sampai</span>
          <input
            type="datetime-local"
            value={penyaring.to}
            min={penyaring.from || undefined}
            onChange={(event) => saring({ to: event.target.value })}
          />
        </label>
        {adaPenyaring ? (
          <button type="button" className="btnTiny" onClick={() => saring(TANPA_PENYARING)}>
            Reset penyaring
          </button>
        ) : null}
        <button type="button" className="btn btnGhost" onClick={() => void load()} disabled={loading}>
          {loading ? 'Memuat…' : 'Muat ulang'}
        </button>
      </div>

      {penyaring.actorUserId || penyaring.targetType ? (
        <div className="filterChips">
          {penyaring.actorUserId ? (
            <span className="filterChip">
              Pelaku: {penyaring.actorLabel || penyaring.actorUserId}
              <button
                type="button"
                aria-label="Hapus penyaring pelaku"
                onClick={() => saring({ actorUserId: '', actorLabel: '' })}
              >
                ×
              </button>
            </span>
          ) : null}
          {penyaring.targetType ? (
            <span className="filterChip">
              Target: {penyaring.targetType}
              {penyaring.targetId ? ` · ${penyaring.targetId.slice(0, 8)}…` : ''}
              <button
                type="button"
                aria-label="Hapus penyaring target"
                onClick={() => saring({ targetType: '', targetId: '' })}
              >
                ×
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="notice noticeError" role="alert">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="muted">Memuat audit log…</p>
      ) : items.length === 0 ? (
        <div className="card emptyCard">
          <p className="emptyCardTitle">
            {adaPenyaring
              ? 'Tidak ada catatan pada penyaring ini.'
              : 'Belum ada tindakan yang tercatat.'}
          </p>
          {adaPenyaring ? (
            <button type="button" className="btnTiny" onClick={() => saring(TANPA_PENYARING)}>
              Tampilkan semua
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="muted auditCount">
            {total.toLocaleString('id-ID')} catatan{adaPenyaring ? ' cocok dengan penyaring ini' : ''}.
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
                    <td className="auditTime" data-label="Waktu">{formatDate(entry.createdAt)}</td>
                    <td data-label="Pelaku">
                      {entry.actor ? (
                        // Diklik untuk melihat seluruh tindakan orang ini.
                        // Penyaringnya sudah lama ada di server; yang belum ada
                        // hanyalah cara memintanya dari sini.
                        <button
                          type="button"
                          className="errorToggle errorToggleStack"
                          title={`Tampilkan hanya tindakan ${entry.actor.fullName}`}
                          onClick={() =>
                            saring({
                              actorUserId: entry.actor?.id ?? '',
                              actorLabel: entry.actor?.fullName ?? '',
                            })
                          }
                        >
                          <span className="cellTitle">{entry.actor.fullName}</span>
                          <span className="cellSub">{entry.actor.email}</span>
                        </button>
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
                            <p className="muted auditNoSnapshot">
                              Tindakan ini tidak menyimpan cuplikan data.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Target">
                      {/* Diklik untuk menelusuri riwayat satu benda: siapa saja
                          yang pernah menyentuhnya, dan dalam urutan apa. */}
                      <button
                        type="button"
                        className="errorToggle errorToggleStack"
                        title={`Tampilkan hanya riwayat ${entry.targetType} ini`}
                        onClick={() =>
                          saring({ targetType: entry.targetType, targetId: entry.targetId ?? '' })
                        }
                      >
                        <span className="cellTitle">{entry.targetType}</span>
                        {entry.targetId ? <span className="cellSub">{entry.targetId}</span> : null}
                      </button>
                    </td>
                    <td data-label="Asal">{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav aria-label="Navigasi halaman audit" className="toolbar enrollmentPager">
              <button
                type="button"
                className="btn btnGhost"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Sebelumnya
              </button>
              <span className="pill">
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
