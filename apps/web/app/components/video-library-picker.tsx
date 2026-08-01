'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

export interface LibraryAsset {
  videoAssetId: string;
  title: string;
  provider: string;
  status: string;
  originalName: string | null;
  sizeBytes: string | null;
  sourceUrl: string | null;
  createdAt: string;
  usedBy: Array<{ lessonId: string; lessonTitle: string; courseId: string; courseTitle: string }>;
}

export function formatBytes(value: string | null): string {
  if (value === null) return '—';
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const satuan = ['B', 'KB', 'MB', 'GB', 'TB'];
  const tingkat = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), satuan.length - 1);
  const angka = bytes / 1024 ** tingkat;
  return `${angka.toFixed(angka >= 10 || tingkat === 0 ? 0 : 1)} ${satuan[tingkat]}`;
}

/** Mengambil isi perpustakaan; dipakai pemilih maupun halaman media. */
export async function fetchLibrary(): Promise<{ items: LibraryAsset[]; totalBytes: string }> {
  const response = await browserClient().GET('/api/v1/admin/videos', {});
  return unwrap(response) as unknown as { items: LibraryAsset[]; totalBytes: string };
}

/**
 * Memilih video yang sudah ada alih-alih mengunggah ulang.
 *
 * Hanya aset berstatus AVAILABLE yang ditawarkan: yang masih diunggah akan
 * ditolak server, dan menampilkannya hanya mengundang klik yang gagal.
 */
export function VideoLibraryPicker({
  lessonTitle,
  onSelect,
  onClose,
  busy,
}: {
  lessonTitle: string;
  onSelect: (videoAssetId: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [items, setItems] = useState<LibraryAsset[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchLibrary();
        setItems(data.items.filter((item) => item.status === 'AVAILABLE'));
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Perpustakaan gagal dimuat.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasil = useMemo(() => {
    const kata = query.trim().toLowerCase();
    if (!kata) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(kata) ||
        (item.originalName ?? '').toLowerCase().includes(kata),
    );
  }, [items, query]);

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Pilih video">
      <div className="modalCard">
        <div className="masterListHead">
          <h2 className="cellTitle">Pilih video untuk “{lessonTitle}”</h2>
          <button className="btnTiny" type="button" onClick={onClose} disabled={busy}>
            Tutup
          </button>
        </div>

        {error ? <p className="notice noticeError">{error}</p> : null}

        <input
          className="userSearch"
          type="search"
          placeholder="Cari judul atau nama berkas…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={loading}
        />

        {loading ? (
          <p className="muted">Memuat perpustakaan…</p>
        ) : hasil.length === 0 ? (
          <p className="muted">
            {items.length === 0
              ? 'Perpustakaan masih kosong. Unggah video lewat halaman Perpustakaan video.'
              : 'Tidak ada video yang cocok dengan pencarian itu.'}
          </p>
        ) : (
          <ul className="masterRecordList">
            {hasil.map((item) => (
              <li key={item.videoAssetId} className="masterRecordCard">
                <div className="masterListHead">
                  <span className="cellTitle">{item.title}</span>
                  <button
                    className="btn btnSmall"
                    type="button"
                    disabled={busy}
                    onClick={() => onSelect(item.videoAssetId)}
                  >
                    Pakai
                  </button>
                </div>
                <p className="cellSub">
                  {item.provider === 'YOUTUBE' ? 'YouTube' : formatBytes(item.sizeBytes)}
                  {item.usedBy.length > 0
                    ? ` · sudah dipakai ${item.usedBy.length} pelajaran`
                    : ' · belum dipakai'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
