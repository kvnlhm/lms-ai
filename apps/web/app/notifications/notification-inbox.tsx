'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../components/notifier';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

type Notification = Schemas['NotificationDto'];

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function NotificationInbox() {
  const notifier = useNotifier();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (onlyUnread: boolean) => {
    setLoading(true);
    setError(null);
    try {
      setItems(
        unwrap(
          await browserClient().GET('/api/v1/me/notifications', {
            params: { query: { unreadOnly: onlyUnread, page: 1, pageSize: 50 } },
          }),
        ) as unknown as Notification[],
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Notifikasi gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(unreadOnly);
  }, [load, unreadOnly]);

  async function markAllRead() {
    if (busy) return;
    setBusy(true);
    try {
      await browserClient().POST('/api/v1/me/notifications/read-all', {});
      await load(unreadOnly);
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
      await load(unreadOnly);
    } catch {
      // Menandai dibaca hanya kenyamanan; kegagalannya tidak perlu mengganggu.
    }
  }

  const unread = items.filter((item) => item.readAt === null).length;

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
      ) : null}
    </section>
  );
}
