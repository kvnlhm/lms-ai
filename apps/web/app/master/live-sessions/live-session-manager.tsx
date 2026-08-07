'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { Modal } from '../../components/modal';
import { useNotifier } from '../../components/notifier';
import { ApiError, browserClient, ensureSuccess, unwrap } from '../../lib/browser-api';

/**
 * Bentuknya datang dari kontrak, bukan disalin dengan tangan.
 *
 * Salinan sebelumnya sudah menyimpang: ia menulis `description: string | null`
 * sementara kontraknya juga mengizinkan `undefined`. Selama pemanggilnya
 * memakai `as unknown as`, selisih itu tidak pernah terlihat.
 */
type LiveSession = Schemas['AdminLiveSessionDto'];

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
  const notifier = useNotifier();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editing, setEditing] = useState<LiveSession | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        unwrap<LiveSession[]>(await browserClient().GET('/api/v1/admin/live-sessions', {})),
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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(editing ? `edit-${editing.id}` : 'create');
    try {
      const body = { title: title.trim(), description: description.trim() || undefined, joinUrl: joinUrl.trim(), startsAt: new Date(startsAt).toISOString(), durationMinutes };
      if (editing) {
        unwrap(await browserClient().PATCH('/api/v1/admin/live-sessions/{sessionId}', { params: { path: { sessionId: editing.id } }, body }));
      } else {
        unwrap(await browserClient().POST('/api/v1/admin/live-sessions', { body: { courseId, ...body } }));
      }
      setTitle('');
      setDescription('');
      setJoinUrl('');
      setEditing(null);
      notifier.success(editing ? 'Event diperbarui.' : 'Event dijadwalkan.');
      setScheduleOpen(false);
      await load();
    } catch (caught) {
      void notifier.error('Sesi gagal dijadwalkan', {
        text: caught instanceof ApiError ? caught.message : undefined,
        reasons: caught instanceof ApiError ? Object.values(caught.fields ?? {}).flat() : [],
      });
    } finally {
      setBusy(null);
    }
  }

  function edit(session: LiveSession) {
    setEditing(session);
    setScheduleOpen(true);
    setCourseId(session.course.id);
    setTitle(session.title);
    setDescription(session.description ?? '');
    setJoinUrl(session.joinUrl);
    setStartsAt(toLocalInputValue(new Date(session.startsAt)));
    setDurationMinutes(session.durationMinutes);
  }

  async function cancel(session: LiveSession) {
    if (busy) return;
    const lanjut = await notifier.confirm(`Batalkan "${session.title}"?`, {
      text: 'Pelajar tidak akan melihat sesi ini lagi.',
      confirmLabel: 'Batalkan sesi',
      cancelLabel: 'Jangan',
      danger: true,
    });
    if (!lanjut) return;
    setBusy(session.id);
    try {
      await browserClient()
        .DELETE('/api/v1/admin/live-sessions/{sessionId}', {
          params: { path: { sessionId: session.id } },
        })
        .then(ensureSuccess);
      notifier.success('Sesi dibatalkan.');
      await load();
    } catch (caught) {
      void notifier.error('Sesi gagal dibatalkan', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  if (courses.length === 0) {
    return <p className="stageNote">Buat kursus terlebih dahulu sebelum menjadwalkan sesi.</p>;
  }

  return (
    <section className="stack masterWorkspace">
      {error ? (
        <p className="notice noticeError" role="alert">
          {error}
        </p>
      ) : null}

      <div className="masterListHead">
        <div>
          <span className="eyebrow">Buat jadwal</span>
          <h2 className="sectionTitle">Jadwalkan sesi baru</h2>
        </div>
        <button className="btn" type="button" disabled={busy !== null} onClick={() => setScheduleOpen(true)}>
          Jadwalkan sesi
        </button>
      </div>

      {scheduleOpen ? (
        <Modal
          title={editing ? 'Sunting event' : 'Jadwalkan sesi baru'}
          description="Pilih kursus, tentukan waktu, lalu masukkan tautan ruang pertemuan."
          busy={busy !== null}
          onClose={() => { setScheduleOpen(false); setEditing(null); }}
        >
      <form className="stack" onSubmit={save}>
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
            placeholder="Contoh: Bedah strategi konten bersama mentor"
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
            placeholder="Berikan gambaran singkat tentang sesi ini."
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
        <div className="fieldRow">
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
        <div className="lessonEditActions">
          <button className="btn btnGhost" type="button" disabled={busy !== null} onClick={() => setScheduleOpen(false)}>
            Batal
          </button>
          <button className="btn" type="submit" disabled={busy !== null}>
            {busy === 'create' ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Jadwalkan'}
          </button>
        </div>
      </form>
        </Modal>
      ) : null}

      <div className="masterListHead">
        <div>
          <span className="eyebrow">Agenda kelas</span>
          <h2 className="sectionTitle">Jadwal tersimpan</h2>
        </div>
        <span className="pill">{sessions.length} sesi</span>
      </div>
      {loading ? <p className="stageNote">Memuat jadwal…</p> : null}
      {!loading && sessions.length === 0 ? (
        <p className="stageNote">Belum ada sesi terjadwal.</p>
      ) : null}
      {!loading && sessions.length > 0 ? (
        <ul className="stack masterRecordList">
          {sessions.map((session) => {
            const cancelled = session.cancelledAt !== null;
            return (
              <li key={session.id} className="card masterRecordCard">
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
                    <div className="rowActions"><button className="btnTiny" type="button" disabled={busy !== null} onClick={() => edit(session)}>Sunting</button><button className="btnTiny" type="button" disabled={busy !== null} onClick={() => void cancel(session)}>Batalkan</button></div>
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
