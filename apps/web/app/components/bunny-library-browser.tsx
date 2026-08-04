'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { Search } from './icons';
import { ApiError, browserClient, unwrapList } from '../lib/browser-api';
import { unggahKeBunny } from '../lib/bunny-upload';
import { formatBytes } from '../lib/video-format';

export type BunnyVideo = Schemas['BunnyLibraryItemDto'];

const UKURAN_HALAMAN = 20;

/** Detik menjadi `12:04`; 0 berarti Bunny belum selesai memprosesnya. */
function formatDurasi(detik: number): string {
  if (detik <= 0) return '—';
  const menit = Math.floor(detik / 60);
  const sisa = Math.round(detik % 60);
  return `${menit}:${String(sisa).padStart(2, '0')}`;
}

/**
 * Isi library Bunny, langsung di dalam aplikasi.
 *
 * Sebelumnya video Bunny tidak terlihat di sini sama sekali sampai seseorang
 * mendaftarkannya, sehingga satu-satunya cara merujuknya adalah membuka
 * dashboard Bunny di tab lain dan menyalin GUID. Daftar ini menghapus langkah
 * itu: yang dilihat Master adalah judul, durasi, dan sampulnya.
 *
 * Penanda "sudah terdaftar" bukan hiasan. Library ini berisi tiga berkas
 * bernama `Outro.mp4` dan dua `Opening.mp4`; tanpa penanda, tidak ada cara
 * membedakan mana yang sudah dipakai selain menghafalnya.
 */
export function BunnyLibraryBrowser({
  awalCari,
  busy,
  onPilih,
  labelAksi = 'Pakai',
}: {
  /** Judul pelajaran atau aset; dipakai sebagai kata pencarian pertama. */
  awalCari?: string;
  busy: boolean;
  onPilih: (video: BunnyVideo) => void;
  labelAksi?: string;
}) {
  const [items, setItems] = useState<BunnyVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [query, setQuery] = useState(awalCari?.trim() ?? '');
  const [loading, setLoading] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persen, setPersen] = useState<number | null>(null);
  const [namaBerkas, setNamaBerkas] = useState('');
  const berkasRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (keyword: string, page: number) => {
    if (page === 1) setLoading(true);
    else setMemuatLagi(true);
    setError(null);
    try {
      const { items: batch, meta } = await unwrapList<BunnyVideo>(
        await browserClient().GET('/api/v1/admin/videos/bunny/library', {
          params: {
            query: { ...(keyword ? { search: keyword } : {}), page, pageSize: UKURAN_HALAMAN },
          },
        }),
      );
      setItems((current) => (page === 1 ? batch : [...current, ...batch]));
      setHalaman(meta.page);
      setTotalHalaman(meta.totalPages);
      setTotal(meta.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Library Bunny gagal dimuat.');
    } finally {
      setLoading(false);
      setMemuatLagi(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(query.trim(), 1), 250);
    return () => clearTimeout(timer);
  }, [load, query]);

  async function unggah(file: File) {
    setPersen(0);
    setNamaBerkas(file.name);
    setError(null);
    try {
      await unggahKeBunny(file, setPersen);
      // Video baru selalu muncul paling atas karena daftarnya urut tanggal;
      // pencariannya dikosongkan supaya ia benar-benar terlihat.
      setQuery('');
      await load('', 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unggahan ke Bunny gagal.');
    } finally {
      setPersen(null);
      if (berkasRef.current) berkasRef.current.value = '';
    }
  }

  const mengunggah = persen !== null;

  return (
    <div className="bunnyBrowser">
      {error ? <p className="notice noticeError">{error}</p> : null}

      <label className="userSearch">
        <span className="srOnly">Cari video di Bunny</span>
        <span aria-hidden="true"><Search size={17} /></span>
        <input
          type="search"
          placeholder="Cari judul video di library Bunny…"
          value={query}
          disabled={mengunggah}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="inlineActions">
        <button
          className="btnSecondary btnSmall"
          type="button"
          disabled={busy || mengunggah}
          onClick={() => berkasRef.current?.click()}
        >
          Unggah video baru ke Bunny
        </button>
        <input
          ref={berkasRef}
          className="srOnly"
          type="file"
          accept="video/mp4,video/*"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void unggah(file);
          }}
        />
      </div>

      {mengunggah ? (
        <div className="videoUploadProgress">
          <p className="cellSub">
            Mengunggah {namaBerkas} langsung ke Bunny — {persen}%
          </p>
          <div className="progress">
            <span style={{ width: `${persen}%` }} />
          </div>
          <small>
            Berkasnya berjalan dari peramban ini ke Bunny tanpa melewati server akademi. Jangan
            tutup halaman ini sampai selesai.
          </small>
        </div>
      ) : null}

      {loading ? (
        <p className="muted">Memuat library Bunny…</p>
      ) : items.length === 0 ? (
        <p className="muted">
          {query.trim() === ''
            ? 'Library Bunny masih kosong. Unggah video pertamamu lewat tombol di atas.'
            : 'Tidak ada video Bunny yang cocok dengan pencarian itu.'}
        </p>
      ) : (
        <>
          <ul className="masterRecordList">
            {items.map((video) => (
              <li key={video.guid} className="masterRecordCard bunnyRow">
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="bunnyThumb" src={video.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <span className="bunnyThumb bunnyThumbKosong" aria-hidden="true" />
                )}
                <div className="bunnyRowBody">
                  <div className="masterListHead">
                    <span className="cellTitle">{video.title}</span>
                    <button
                      className="btn btnSmall"
                      type="button"
                      // Video yang belum selesai diproses Bunny memang boleh
                      // masuk perpustakaan, tetapi belum dapat diputar; yang
                      // gagal tidak akan pernah bisa.
                      disabled={busy || mengunggah || video.status === 'FAILED'}
                      onClick={() => onPilih(video)}
                    >
                      {labelAksi}
                    </button>
                  </div>
                  <p className="cellSub">
                    {formatDurasi(video.durationSeconds)} · {formatBytes(video.sizeBytes)}
                    {video.status === 'READY' ? '' : video.status === 'FAILED' ? ' · gagal diproses Bunny' : ' · masih diproses Bunny'}
                  </p>
                  <p className="cellSub">
                    {video.videoAssetId === null
                      ? 'Belum terdaftar di perpustakaan akademi.'
                      : video.usedByLessons > 0
                        ? `Sudah terdaftar · dipakai ${video.usedByLessons} pelajaran`
                        : 'Sudah terdaftar · belum dipakai pelajaran'}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {halaman < totalHalaman ? (
            <div className="muatLagi">
              <p className="muted">
                Menampilkan {items.length} dari {total} video Bunny
              </p>
              <button
                className="btnSecondary"
                type="button"
                disabled={memuatLagi || busy || mengunggah}
                onClick={() => void load(query.trim(), halaman + 1)}
              >
                {memuatLagi ? 'Memuat…' : 'Muat lebih banyak'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
