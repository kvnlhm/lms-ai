'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrap, unwrapList } from '../lib/browser-api';

/** Bentuknya datang dari OpenAPI, jadi perubahan di API terlihat saat typecheck. */
export type LibraryAsset = Schemas['VideoLibraryItemDto'];
export type LibrarySummary = Schemas['VideoLibrarySummaryDto'];
export type LibraryFilter = 'USED' | 'ORPHAN' | 'PROBLEM' | 'AVAILABLE';

export const UKURAN_HALAMAN_PERPUSTAKAAN = 20;

export function formatBytes(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const satuan = ['B', 'KB', 'MB', 'GB', 'TB'];
  const tingkat = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), satuan.length - 1);
  const angka = bytes / 1024 ** tingkat;
  return `${angka.toFixed(angka >= 10 || tingkat === 0 ? 0 : 1)} ${satuan[tingkat]}`;
}

/**
 * Mengambil satu halaman perpustakaan; dipakai pemilih maupun halaman media.
 *
 * Pencarian dan penyaringan dikerjakan server. Sebelumnya seluruh isi
 * perpustakaan diunduh sekaligus — setiap aset lengkap dengan seluruh
 * pemakaiannya — lalu disaring di browser. Itu nyaman selama isinya sedikit,
 * dan berubah menjadi satu permintaan yang tumbuh tanpa batas begitu videonya
 * banyak.
 */
export async function ambilPerpustakaan(params: {
  search?: string;
  filter?: LibraryFilter;
  page?: number;
  pageSize?: number;
}): Promise<{ items: LibraryAsset[]; meta: Schemas['PaginatedMetaDto'] }> {
  return unwrapList<LibraryAsset>(
    await browserClient().GET('/api/v1/admin/videos', {
      params: {
        query: {
          ...(params.search ? { search: params.search } : {}),
          ...(params.filter ? { filter: params.filter } : {}),
          page: params.page ?? 1,
          pageSize: params.pageSize ?? UKURAN_HALAMAN_PERPUSTAKAAN,
        },
      },
    }),
  );
}

/** Angka untuk seluruh perpustakaan, bukan untuk halaman yang sedang tampil. */
export async function ambilRingkasanPerpustakaan(): Promise<LibrarySummary> {
  return unwrap<LibrarySummary>(await browserClient().GET('/api/v1/admin/videos/summary', {}));
}

/**
 * Memilih video yang sudah ada alih-alih mengunggah ulang.
 *
 * Hanya aset berstatus AVAILABLE yang ditawarkan: yang masih diunggah akan
 * ditolak server, dan menampilkannya hanya mengundang klik yang gagal.
 * Penyaringan itu kini dilakukan server, bukan setelah barisnya terlanjur
 * terambil — kalau disaring belakangan, satu halaman bisa tampil kosong
 * padahal masih ada video berikutnya.
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
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [query, setQuery] = useState('');
  const [kataTermuat, setKataTermuat] = useState('');
  const [loading, setLoading] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (keyword: string, page: number) => {
    if (page === 1) setLoading(true);
    else setMemuatLagi(true);
    setError(null);
    try {
      const { items: batch, meta } = await ambilPerpustakaan({
        search: keyword || undefined,
        filter: 'AVAILABLE',
        page,
      });
      setItems((current) => (page === 1 ? batch : [...current, ...batch]));
      setKataTermuat(keyword);
      setHalaman(meta.page);
      setTotalHalaman(meta.totalPages);
      setTotal(meta.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Perpustakaan gagal dimuat.');
    } finally {
      setLoading(false);
      setMemuatLagi(false);
    }
  }, []);

  // Pencarian kini menempuh jaringan, jadi ketikan ditahan sebentar dulu —
  // tanpa jeda ini setiap huruf menjadi satu permintaan.
  useEffect(() => {
    const timer = setTimeout(() => void load(query.trim(), 1), 250);
    return () => clearTimeout(timer);
  }, [load, query]);

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
          placeholder="Cari judul, nama berkas, atau pelajaran yang memakainya…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        {loading ? (
          <p className="muted">Memuat perpustakaan…</p>
        ) : items.length === 0 ? (
          <p className="muted">
            {kataTermuat === ''
              ? 'Perpustakaan masih kosong. Unggah video lewat halaman Perpustakaan video.'
              : 'Tidak ada video yang cocok dengan pencarian itu.'}
          </p>
        ) : (
          <>
            <ul className="masterRecordList">
              {items.map((item) => (
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

            {halaman < totalHalaman ? (
              <div className="muatLagi">
                <p className="muted">
                  Menampilkan {items.length} dari {total} video
                </p>
                <button
                  className="btnSecondary"
                  type="button"
                  disabled={memuatLagi || busy}
                  onClick={() => void load(kataTermuat, halaman + 1)}
                >
                  {memuatLagi ? 'Memuat…' : 'Muat lebih banyak'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
