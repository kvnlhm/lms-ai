'use client';

import type { Schemas } from '@lms/api-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useNotifier } from '../components/notifier';
import { ApiError, browserClient, ensureSuccess } from '../lib/browser-api';

type DeviceSession = Schemas['DeviceSessionDto'];

export function SessionManager({ sessions }: { sessions: DeviceSession[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const notifier = useNotifier();

  async function revoke(session: DeviceSession) {
    // Mencabut perangkat ini sendiri berarti langsung keluar. Perangkat lain
    // tidak perlu ditanya: mencabutnya justru tindakan pengamanan yang
    // memang disengaja, dan pemiliknya tinggal masuk lagi.
    if (session.isCurrent) {
      const lanjut = await notifier.confirm('Keluar dari perangkat ini?', {
        text: 'Kamu akan langsung keluar dan perlu masuk kembali untuk melanjutkan.',
        confirmLabel: 'Keluar',
        danger: true,
      });
      if (!lanjut) return;
    }

    if (busy) return;
    setBusy(session.id);
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
      void notifier.error('Perangkat gagal dicabut', {
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
      });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Mencabut seluruh perangkat sekaligus.
   *
   * Ini termasuk perangkat yang sedang dipakai — endpointnya memang menghapus
   * seluruh sesi dan membersihkan cookie. Jadi dialognya menyebutkan itu lebih
   * dulu, dan sesudahnya kita antar ke halaman masuk alih-alih menyegarkan
   * halaman yang sudah tidak punya sesi.
   */
  async function revokeAll() {
    const lanjut = await notifier.confirm('Keluar dari semua perangkat?', {
      text:
        `Seluruh ${sessions.length} perangkat dikeluarkan, termasuk yang sedang kamu pakai. ` +
        'Kamu perlu masuk kembali di setiap perangkat yang masih kamu gunakan.',
      confirmLabel: 'Keluar dari semua',
      danger: true,
    });
    if (!lanjut || busy) return;

    setBusy('semua');
    try {
      ensureSuccess(await browserClient().POST('/api/v1/auth/logout-all', {}));
      window.location.assign('/login');
    } catch (caught) {
      setBusy(null);
      void notifier.error('Perangkat gagal dikeluarkan', {
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
      });
    }
  }

  return (
    <section className="card profileSection">
      <div className="profileSectionHead">
        <h2>Perangkat aktif</h2>
        <p>Cabut akses perangkat yang tidak kamu kenali.</p>
      </div>
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
      {/* Hanya bila ada lebih dari satu perangkat. Dengan satu sesi, tombol ini
          persis sama dengan "Keluar di sini" di atas — dua tombol untuk satu
          tindakan hanya membuat orang ragu memilih. */}
      {sessions.length > 1 ? (
        <div className="sessionBulk">
          <p>Kehilangan perangkat, atau curiga akunmu dipakai orang lain?</p>
          <button
            className="btn btnGhost btnTiny sessionBulkAction"
            type="button"
            disabled={busy !== null}
            onClick={() => void revokeAll()}
          >
            {busy === 'semua' ? 'Mengeluarkan…' : 'Keluar dari semua perangkat'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
