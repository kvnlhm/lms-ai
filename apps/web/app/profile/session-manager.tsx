'use client';

import type { Schemas } from '@lms/api-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, browserClient, ensureSuccess } from '../lib/browser-api';

type DeviceSession = Schemas['DeviceSessionDto'];

export function SessionManager({ sessions }: { sessions: DeviceSession[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(session: DeviceSession) {
    if (busy) return;
    setBusy(session.id);
    setError(null);
    try {
      ensureSuccess(
        await browserClient().DELETE('/api/v1/auth/sessions/{sessionId}', {
          params: { path: { sessionId: session.id } },
        }),
      );
      if (session.isCurrent) {
        window.location.assign('/login');
      } else {
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card profileSection">
      <div className="profileSectionHead">
        <h2>Perangkat aktif</h2>
        <p>Cabut akses perangkat yang tidak Anda kenali.</p>
      </div>
      {error ? <p className="notice noticeError profileSessionNotice" role="alert">{error}</p> : null}
      <div className="sessionList">
        {sessions.map((session) => (
          <div className="sessionRow" key={session.id}>
            <span className="sessionIcon" aria-hidden="true">●</span>
            <div>
              <strong>
                {session.deviceName || 'Perangkat tanpa nama'}
                {session.isCurrent ? ' · Perangkat ini' : ''}
              </strong>
              <small>Terakhir aktif {formatDate(session.lastUsedAt)}</small>
            </div>
            <button className="btn btnGhost btnTiny" type="button" disabled={busy !== null} onClick={() => revoke(session)}>
              {busy === session.id
                ? 'Mencabut…'
                : session.isCurrent
                  ? 'Keluar di sini'
                  : 'Cabut akses'}
            </button>
          </div>
        ))}
        {sessions.length === 0 ? <p className="empty">Tidak ada perangkat aktif.</p> : null}
      </div>
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
