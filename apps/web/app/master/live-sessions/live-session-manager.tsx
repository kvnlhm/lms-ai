'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, browserClient, ensureSuccess, unwrap } from '../../lib/browser-api';

interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  joinUrl: string;
  startsAt: string;
  durationMinutes: number;
  cancelledAt: string | null;
  course: { id: string; title: string };
}

interface CourseOption {
  id: string;
  title: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
}

/** `datetime-local` menuntut format tanpa zona waktu, dalam waktu lokal peramban. */
function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function LiveSessionManager({ courses }: { courses: CourseOption[] }) {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [startsAt, setStartsAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 24 * 3_600_000)),
  );
  const [durationMinutes, setDurationMinutes] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(
        unwrap(await browserClient().GET('/api/v1/admin/live-sessions', {})) as unknown as
          LiveSession[],
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Jadwal gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy('create');
    setError(null);
    setReasons([]);
    setNotice(null);
    try {
      unwrap(
        await browserClient().POST('/api/v1/admin/live-sessions', {
          body: {
            courseId,
            title: title.trim(),
            description: description.trim() || undefined,
            joinUrl: joinUrl.trim(),
            // Input bernilai waktu lokal; server menyimpannya sebagai UTC.
            startsAt: new Date(startsAt).toISOString(),
            durationMinutes,
          },
        }),
      );
      setTitle('');
      setDescription('');
      setJoinUrl('');
      setNotice('Sesi dijadwalkan.');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sesi gagal dijadwalkan.');
      if (caught instanceof ApiError) setReasons(Object.values(caught.fields ?? {}).flat());
    } finally {
      setBusy(null);
    }
  }

  async function cancel(session: LiveSession) {
    if (busy) return;
    if (!window.confirm(`Batalkan "${session.title}"? Pelajar tidak akan melihatnya lagi.`)) return;
    setBusy(session.id);
    setError(null);
    setNotice(null);
    try {
      await browserClient()
        .DELETE('/api/v1/admin/live-sessions/{sessionId}', {
          params: { path: { sessionId: session.id } },
        })
        .then(ensureSuccess);
      setNotice('Sesi dibatalkan.');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sesi gagal dibatalkan.');
    } finally {
      setBusy(null);
    }
  }

  if (courses.length === 0) {
    return <p className="stageNote">Buat kursus terlebih dahulu sebelum menjadwalkan sesi.</p>;
  }

  return (
    <section className="stack">
      {error ? (
        <div className="notice noticeError" role="alert">
          <p>{error}</p>
          {reasons.length > 0 ? (
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <div className="notice" role="status">
          {notice}
        </div>
      ) : null}

      <form className="card stack" onSubmit={create}>
        <h2 className="sectionTitle">Jadwalkan sesi baru</h2>
        <label className="field">
          <span>Kursus</span>
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.currentTarget.value)}
            disabled={busy !== null}
            required
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Judul sesi</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            minLength={3}
            maxLength={200}
            required
            disabled={busy !== null}
          />
        </label>
        <label className="field">
          <span>Keterangan (opsional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            rows={2}
            maxLength={1000}
            disabled={busy !== null}
          />
        </label>
        <label className="field">
          <span>Tautan rapat</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://zoom.us/j/…"
            value={joinUrl}
            onChange={(event) => setJoinUrl(event.currentTarget.value)}
            maxLength={500}
            required
            disabled={busy !== null}
          />
        </label>
        <small className="muted">
          Didukung: Zoom, Google Meet, Microsoft Teams, Whereby, dan Jitsi. Tautan wajib https.
        </small>
        <div className="rowBetween">
          <label className="field">
            <span>Mulai</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.currentTarget.value)}
              required
              disabled={busy !== null}
            />
          </label>
          <label className="field">
            <span>Durasi (menit)</span>
            <input
              type="number"
              min={5}
              max={600}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.currentTarget.value))}
              required
              disabled={busy !== null}
            />
          </label>
        </div>
        <button className="btn btnBlock" type="submit" disabled={busy !== null}>
          {busy === 'create' ? 'Menyimpan…' : 'Jadwalkan'}
        </button>
      </form>

      <h2 className="sectionTitle">Jadwal tersimpan</h2>
      {loading ? <p className="stageNote">Memuat jadwal…</p> : null}
      {!loading && sessions.length === 0 ? (
        <p className="stageNote">Belum ada sesi terjadwal.</p>
      ) : null}
      {!loading && sessions.length > 0 ? (
        <ul className="stack">
          {sessions.map((session) => {
            const cancelled = session.cancelledAt !== null;
            return (
              <li key={session.id} className="card">
                <div className="rowBetween">
                  <div>
                    <strong>{session.title}</strong>
                    <small className="muted">
                      {session.course.title} · {formatDate(session.startsAt)} ·{' '}
                      {session.durationMinutes} menit
                    </small>
                  </div>
                  {cancelled ? (
                    <span className="pill pillDanger">Dibatalkan</span>
                  ) : (
                    <button
                      className="btnTiny"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void cancel(session)}
                    >
                      Batalkan
                    </button>
                  )}
                </div>
                {session.description ? <p>{session.description}</p> : null}
                <small className="muted">{session.joinUrl}</small>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
