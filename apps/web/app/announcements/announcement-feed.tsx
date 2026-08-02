'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrapList } from '../lib/browser-api';

type Announcement = Schemas['LearnerAnnouncementDto'];

/** Sengaja lebih kecil dari batas lama: sisanya kini dapat dijangkau. */
const UKURAN_HALAMAN = 20;

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function AnnouncementFeed() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [loading, setLoading] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Halaman pertama menggantikan isi, halaman berikutnya menyambung.
   *
   * Sebelumnya lima puluh pengumuman pertama diperlakukan sebagai seluruhnya,
   * sehingga yang lebih lama tidak pernah dapat dibaca — tanpa satu pun tanda
   * bahwa ia ada.
   */
  const load = useCallback(async (page: number) => {
    if (page === 1) setLoading(true);
    else setMemuatLagi(true);
    setError(null);
    try {
      const { items: batch, meta } = unwrapList<Announcement>(
        await browserClient().GET('/api/v1/me/announcements', {
          params: { query: { page, pageSize: UKURAN_HALAMAN } },
        }),
      );
      setItems((current) => (page === 1 ? batch : [...current, ...batch]));
      setHalaman(meta.page);
      setTotalHalaman(meta.totalPages);
      setTotal(meta.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Pengumuman gagal dimuat.');
    } finally {
      setLoading(false);
      setMemuatLagi(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function markRead(id: string) {
    try {
      await browserClient().POST('/api/v1/me/announcements/{announcementId}/read', {
        params: { path: { announcementId: id } },
      });
      // Ditandai di tempat, bukan dengan memuat ulang: memuat ulang akan
      // membuang halaman-halaman yang sudah dibuka pembaca.
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    } catch {
      // Penanda baca hanya kenyamanan; kegagalannya tidak perlu mengganggu.
    }
  }

  if (loading) return <p className="stageNote">Memuat pengumuman…</p>;
  if (error) {
    return (
      <div className="notice noticeError" role="alert">
        {error}
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="stageNote">Belum ada pengumuman untukmu saat ini.</p>;
  }

  return (
    <>
      <ul className="stack">
        {items.map((item) => (
          <li key={item.id} className={item.readAt === null ? 'card cardAccent' : 'card'}>
            <div className="rowBetween">
              <div>
                <strong>{item.title}</strong>
                <small className="muted">
                  {formatDate(item.publishedAt)}
                  {item.endsAt ? ` · berlaku sampai ${formatDate(item.endsAt)}` : ''}
                </small>
              </div>
              {item.readAt === null ? <span className="pill pillAccent">Baru</span> : null}
            </div>
            <p>{item.body}</p>
            {item.readAt === null ? (
              <span className="inlineActions">
                <button className="btnTiny" type="button" onClick={() => void markRead(item.id)}>
                  Tandai dibaca
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {halaman < totalHalaman ? (
        <div className="muatLagi">
          <p className="muted">
            Menampilkan {items.length} dari {total} pengumuman
          </p>
          <button
            className="btnSecondary"
            type="button"
            disabled={memuatLagi}
            onClick={() => void load(halaman + 1)}
          >
            {memuatLagi ? 'Memuat…' : 'Muat lebih banyak'}
          </button>
        </div>
      ) : null}
    </>
  );
}
