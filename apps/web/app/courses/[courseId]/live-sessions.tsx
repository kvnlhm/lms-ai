import type { Schemas } from '@lms/api-client';
import { serverClient } from '../../lib/api';

type Session = Schemas['LearnerLiveSessionDto'];

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
}

/**
 * Jadwal sesi langsung pada halaman kursus.
 *
 * Kegagalan di sini tidak boleh menjatuhkan halaman kursus — jadwal hanyalah
 * pelengkap, sementara silabus dan tombol belajar adalah isi utamanya.
 */
export async function LiveSessions({ courseId }: { courseId: string }) {
  const client = await serverClient();
  const response = await client.GET('/api/v1/learn/courses/{courseId}/live-sessions', {
    params: { path: { courseId } },
  });
  if (response.error !== undefined || !response.data) return null;

  const sessions = (response.data.data as unknown as Session[]).filter(
    (session) => session.status !== 'ENDED',
  );
  if (sessions.length === 0) return null;

  return (
    <section className="stack">
      <h2 className="sectionTitle">Sesi langsung</h2>
      <ul className="stack">
        {sessions.map((session) => (
          <li key={session.id} className="card">
            <div className="rowBetween">
              <div>
                <strong>{session.title}</strong>
                <small className="muted">
                  {formatDate(session.startsAt)} · {session.durationMinutes} menit
                </small>
              </div>
              {session.status === 'LIVE' && session.joinUrl ? (
                <a
                  className="btn"
                  href={session.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Gabung sekarang
                </a>
              ) : (
                <span className="pill">Belum dibuka</span>
              )}
            </div>
            {session.description ? <p>{session.description}</p> : null}
            {session.status === 'UPCOMING' ? (
              <small className="muted">
                Tombol gabung terbuka 15 menit sebelum sesi dimulai.
              </small>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
