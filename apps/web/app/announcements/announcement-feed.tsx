'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

type Announcement = Schemas['LearnerAnnouncementDto'];

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function AnnouncementFeed() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(
        unwrap(
          await browserClient().GET('/api/v1/me/announcements', {
            params: { query: { page: 1, pageSize: 50 } },
          }),
        ) as unknown as Announcement[],
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Pengumuman gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await browserClient().POST('/api/v1/me/announcements/{announcementId}/read', {
        params: { path: { announcementId: id } },
      });
      await load();
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
  );
}
