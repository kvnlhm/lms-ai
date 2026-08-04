'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { Search } from './icons';
import { ApiError, browserClient, unwrap, unwrapList } from '../lib/browser-api';
import { formatBytes, namaPenyedia } from '../lib/video-format';
import { BunnyLibraryBrowser, type BunnyVideo } from './bunny-library-browser';

/** Bentuknya datang dari OpenAPI, jadi perubahan di API terlihat saat typecheck. */
export type LibraryAsset = Schemas['VideoLibraryItemDto'];
export type LibrarySummary = Schemas['VideoLibrarySummaryDto'];
export type LibraryFilter = 'USED' | 'ORPHAN' | 'PROBLEM' | 'AVAILABLE';

export const UKURAN_HALAMAN_PERPUSTAKAAN = 20;

// Dipakai di berkas ini sekaligus diteruskan, supaya halaman yang sudah
// mengimpornya dari sini tidak perlu ikut berubah.
export { formatBytes, namaPenyedia };

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
  onSelectBunny,
  onClose,
  busy,
  tabAwal = 'AKADEMI',
}: {
  lessonTitle: string;
  onSelect: (videoAssetId: string) => void;
  /** Memilih video Bunny yang mungkin belum terdaftar; pemanggil yang mendaftarkannya. */
  onSelectBunny?: (video: BunnyVideo) => void;
  onClose: () => void;
  busy: boolean;
  tabAwal?: 'AKADEMI' | 'BUNNY';
}) {
  const [items, setItems] = useState<LibraryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [tab, setTab] = useState<'AKADEMI' | 'BUNNY'>(tabAwal);
  /**
   * Judul pelajarannya sudah diketahui aplikasi, jadi mengetiknya ulang adalah
   * pekerjaan yang tidak perlu ada. Video yang benar hampir selalu bernama
   * mirip pelajarannya; dengan ini ia sudah di layar sebelum ada yang mengetik.
   */
  const [query, setQuery] = useState(lessonTitle.trim());
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
    if (tab !== 'AKADEMI') return undefined;
    const timer = setTimeout(() => void load(query.trim(), 1), 250);
    return () => clearTimeout(timer);
  }, [load, query, tab]);

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

        {onSelectBunny ? (
          <div className="inlineActions">
            {(
              [
                ['AKADEMI', 'Perpustakaan akademi'],
                ['BUNNY', 'Library Bunny'],
              ] as const
            ).map(([nilai, label]) => (
              <button
                key={nilai}
                type="button"
                className={tab === nilai ? 'btnTiny btnActive' : 'btnTiny'}
                aria-pressed={tab === nilai}
                disabled={busy}
                onClick={() => setTab(nilai)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {onSelectBunny && tab === 'BUNNY' ? (
          <BunnyLibraryBrowser awalCari={lessonTitle} busy={busy} onPilih={onSelectBunny} />
        ) : (
          <>
        {/* Kelasnya dulu dipasang langsung pada `input`, padahal `.userSearch`
            adalah pembungkus: ikonnya tidak pernah muncul dan gaya inputnya
            tidak pernah menyala. Strukturnya kini sama dengan halaman
            Pengguna dan Perpustakaan video. */}
        <label className="userSearch">
          <span className="srOnly">Cari video</span>
          <span aria-hidden="true"><Search size={17} /></span>
          <input
            type="search"
            placeholder="Cari judul, nama berkas, atau pelajaran yang memakainya…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

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
            <ul className="stack masterRecordList">
              {items.map((item) => (
                <li key={item.videoAssetId} className="card masterRecordCard">
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
                    {item.provider === 'SELF_HOSTED'
                      ? formatBytes(item.sizeBytes)
                      : namaPenyedia(item.provider)}
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
          </>
        )}
      </div>
    </div>
  );
}
