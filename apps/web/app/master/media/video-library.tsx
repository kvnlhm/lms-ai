'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';

interface Usage {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
}

interface LibraryItem {
  videoAssetId: string;
  title: string;
  provider: string;
  status: string;
  originalName: string | null;
  sizeBytes: string | null;
  sourceUrl: string | null;
  createdAt: string;
  usedBy: Usage[];
}

/**
 * Ukuran datang sebagai string karena kolomnya BigInt di database, dan
 * mengubahnya menjadi Number lebih awal akan membulatkan diam-diam pada berkas
 * yang sangat besar.
 */
function formatSize(value: string | null): string {
  if (value === null) return '—';
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const satuan = ['B', 'KB', 'MB', 'GB', 'TB'];
  const tingkat = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), satuan.length - 1);
  const angka = bytes / 1024 ** tingkat;
  return `${angka.toFixed(angka >= 10 || tingkat === 0 ? 0 : 1)} ${satuan[tingkat]}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function VideoLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [totalBytes, setTotalBytes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await browserClient().GET('/api/v1/admin/videos', {});
      const data = unwrap(response) as unknown as { items: LibraryItem[]; totalBytes: string };
      setItems(data.items);
      setTotalBytes(data.totalBytes);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Perpustakaan gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function hapus(item: LibraryItem) {
    if (busy) return;
    // Berkas hilang dari disk dan tidak dapat dikembalikan dari sini; hanya
    // backup yang bisa. Karena itu penghapusannya dikonfirmasi lebih dulu.
    if (!window.confirm(`Hapus "${item.title}" beserta berkasnya? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setBusy(item.videoAssetId);
    setError(null);
    try {
      unwrap(
        await browserClient().DELETE('/api/v1/admin/videos/{videoAssetId}', {
          params: { path: { videoAssetId: item.videoAssetId } },
        }),
      );
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Video gagal dihapus.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="muted">Memuat perpustakaan…</p>;

  const terpakai = items.filter((item) => item.usedBy.length > 0).length;
  const yatim = items.length - terpakai;

  return (
    <section className="stack">
      {error ? <p className="notice noticeError">{error}</p> : null}

      <p className="muted">
        {items.length} video · {formatSize(totalBytes)} terpakai di disk · {terpakai} dipakai
        pelajaran · {yatim} belum dipakai
      </p>

      {items.length === 0 ? (
        <p className="muted">
          Belum ada video. Unggah lewat penyusun kursus, lalu video itu akan muncul di sini dan
          dapat dipakai ulang oleh pelajaran mana pun.
        </p>
      ) : (
        <ul className="masterRecordList">
          {items.map((item) => (
            <li key={item.videoAssetId} className="masterRecordCard">
              <div className="masterListHead">
                <h2 className="cellTitle">{item.title}</h2>
                <span className="pill">{item.provider === 'YOUTUBE' ? 'YouTube' : 'Self-hosted'}</span>
              </div>

              <p className="muted">
                {item.originalName ?? item.sourceUrl ?? '—'} · {formatSize(item.sizeBytes)} ·{' '}
                {item.status} · ditambahkan {formatDate(item.createdAt)}
              </p>

              {item.usedBy.length === 0 ? (
                <p className="muted">Belum dipakai pelajaran mana pun.</p>
              ) : (
                <ul className="reasonList">
                  {item.usedBy.map((usage) => (
                    <li key={usage.lessonId}>
                      <Link href={`/master/courses/${usage.courseId}`}>
                        {usage.courseTitle} — {usage.lessonTitle}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="inlineActions">
                <button
                  type="button"
                  className="btn btnDanger btnSmall"
                  // Dibiarkan dapat ditekan meski masih dipakai: pesan dari
                  // server menyebut berapa pelajaran yang memakainya, yang
                  // lebih berguna daripada tombol mati tanpa penjelasan.
                  disabled={busy === item.videoAssetId}
                  onClick={() => void hapus(item)}
                >
                  {busy === item.videoAssetId ? 'Menghapus…' : 'Hapus'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
