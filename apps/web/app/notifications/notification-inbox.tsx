'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../components/notifier';
import { ApiError, browserClient, unwrap, unwrapList } from '../lib/browser-api';

type Notification = Schemas['NotificationDto'];

/** Sengaja lebih kecil dari batas lama: sisanya kini dapat dijangkau. */
const UKURAN_HALAMAN = 20;

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function NotificationInbox() {
  const notifier = useNotifier();
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Halaman pertama menggantikan isi, halaman berikutnya menyambung.
   *
   * Sebelumnya lima puluh notifikasi pertama diperlakukan sebagai seluruhnya;
   * yang lebih lama tidak dapat dibuka sama sekali.
   */
  const load = useCallback(async (onlyUnread: boolean, page: number) => {
    if (page === 1) setLoading(true);
    else setMemuatLagi(true);
    setError(null);
    try {
      const { items: batch, meta } = unwrapList<Notification>(
        await browserClient().GET('/api/v1/me/notifications', {
          params: { query: { unreadOnly: onlyUnread, page, pageSize: UKURAN_HALAMAN } },
        }),
      );
      setItems((current) => (page === 1 ? batch : [...current, ...batch]));
      setHalaman(meta.page);
      setTotalHalaman(meta.totalPages);
      setTotal(meta.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Notifikasi gagal dimuat.');
    } finally {
      setLoading(false);
      setMemuatLagi(false);
    }
  }, []);

  /**
   * Jumlah belum dibaca diambil dari endpointnya sendiri, bukan dihitung dari
   * baris yang kebetulan sudah termuat — angka yang dihitung dari satu halaman
   * akan berhenti bertambah begitu daftarnya lebih panjang dari halaman itu.
   */
  const muatJumlahBelumDibaca = useCallback(async () => {
    try {
      const data = unwrap<Schemas['UnreadCountDto']>(
        await browserClient().GET('/api/v1/me/notifications/unread-count', {}),
      );
      setUnread(data.unread);
    } catch {
      // Angka pada label saja; kegagalannya tidak perlu menutupi daftar.
    }
  }, []);

  useEffect(() => {
    void load(unreadOnly, 1);
  }, [load, unreadOnly]);

  useEffect(() => {
    void muatJumlahBelumDibaca();
  }, [muatJumlahBelumDibaca]);

  async function markAllRead() {
    if (busy) return;
    setBusy(true);
    try {
      await browserClient().POST('/api/v1/me/notifications/read-all', {});
      await Promise.all([load(unreadOnly, 1), muatJumlahBelumDibaca()]);
    } catch (caught) {
      void notifier.error('Gagal menandai sudah dibaca', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function markRead(id: string) {
    try {
      await browserClient().PATCH('/api/v1/me/notifications/{notificationId}/read', {
        params: { path: { notificationId: id } },
      });
      // Diubah di tempat supaya halaman-halaman yang sudah dibuka tidak hilang.
      // Pada saringan "belum dibaca" barisnya memang harus pergi, seperti
      // sebelumnya.
      setItems((current) =>
        unreadOnly
          ? current.filter((item) => item.id !== id)
          : current.map((item) =>
              item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
            ),
      );
      setUnread((current) => Math.max(0, current - 1));
      if (unreadOnly) setTotal((current) => Math.max(0, current - 1));
    } catch {
      // Menandai dibaca hanya kenyamanan; kegagalannya tidak perlu mengganggu.
    }
  }

  return (
    <section className="stack notificationWorkspace">
      <div className="notificationToolbar">
        <nav className="tabRow" aria-label="Saringan notifikasi">
          <button
            type="button"
            className={unreadOnly ? 'btnTiny' : 'btnTiny btnActive'}
            onClick={() => setUnreadOnly(false)}
            aria-pressed={!unreadOnly}
          >
            Semua
          </button>
          <button
            type="button"
            className={unreadOnly ? 'btnTiny btnActive' : 'btnTiny'}
            onClick={() => setUnreadOnly(true)}
            aria-pressed={unreadOnly}
          >
            Belum dibaca{unread > 0 ? ` (${unread})` : ''}
          </button>
        </nav>
        {unread > 0 ? (
          <button
            className="btnSecondary btnSmall"
            type="button"
            disabled={busy}
            onClick={() => void markAllRead()}
          >
            Tandai semua dibaca
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="notice noticeError" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="stageNote">Memuat notifikasi…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="stageNote">
          {unreadOnly ? 'Semua notifikasi sudah dibaca.' : 'Belum ada notifikasi.'}
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <ul className="stack notificationList">
            {items.map((item) => (
              <li
                key={item.id}
                className={
                  item.readAt === null
                    ? 'card cardAccent notificationCard notificationUnread'
                    : 'card notificationCard'
                }
              >
                <span className="notificationDot" aria-hidden="true" />
                <div className="rowBetween">
                  <div>
                    <strong>{item.title}</strong>
                    <small className="muted">{formatDate(item.createdAt)}</small>
                  </div>
                  {item.readAt === null ? <span className="pill pillAccent">Baru</span> : null}
                </div>
                <p>{item.body}</p>
                <span className="inlineActions">
                  {item.linkUrl ? (
                    <Link
                      className="btnTiny"
                      href={item.linkUrl}
                      onClick={() => void markRead(item.id)}
                    >
                      Buka
                    </Link>
                  ) : null}
                  {item.readAt === null ? (
                    <button className="btnTiny" type="button" onClick={() => void markRead(item.id)}>
                      Tandai dibaca
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {halaman < totalHalaman ? (
            <div className="muatLagi">
              <p className="muted">
                Menampilkan {items.length} dari {total} notifikasi
              </p>
              <button
                className="btnSecondary"
                type="button"
                disabled={memuatLagi}
                onClick={() => void load(unreadOnly, halaman + 1)}
              >
                {memuatLagi ? 'Memuat…' : 'Muat lebih banyak'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
