'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { Modal } from '../../components/modal';
import { ActionMenu } from '../../components/action-menu';
import { useNotifier } from '../../components/notifier';
import { ApiError, browserClient, ensureSuccess, unwrapList } from '../../lib/browser-api';

/** Bentuknya datang dari OpenAPI, jadi perubahan di API terlihat saat typecheck. */
type Announcement = Schemas['AdminAnnouncementDto'];
type Audience = Announcement['audience'];
type Status = Announcement['status'];

/** Sengaja lebih kecil dari batas lama: sisanya kini dapat dijangkau. */
const UKURAN_HALAMAN = 20;

const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL_USERS: 'Semua pengguna',
  COURSE_LEARNERS: 'Peserta kursus',
  SPECIFIC_USERS: 'Pengguna tertentu',
};

const STATUS_PILL: Record<Status, { className: string; label: string }> = {
  DRAFT: { className: 'pill', label: 'Draft' },
  PUBLISHED: { className: 'pill pillGood', label: 'Terbit' },
  ARCHIVED: { className: 'pill pillWarn', label: 'Diarsipkan' },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** `datetime-local` menuntut waktu lokal tanpa zona. */
function toLocalInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AnnouncementManager({ courses }: { courses: { id: string; title: string }[] }) {
  const notifier = useNotifier();
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Hanya kegagalan memuat daftar yang tetap tampil di halaman: tanpa daftar,
  // pesan itulah satu-satunya isi yang tersisa.
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('ALL_USERS');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [scheduled, setScheduled] = useState(false);
  const [publishedAt, setPublishedAt] = useState(() => toLocalInputValue(new Date()));
  const [endsAt, setEndsAt] = useState('');

  /**
   * Sebelumnya lima puluh pengumuman pertama diperlakukan sebagai seluruhnya,
   * sehingga yang lebih lama tidak dapat diterbitkan, diarsipkan, maupun
   * dihapus lagi — padahal jumlah pada label mengatakan semuanya ada.
   *
   * Bila halaman yang diminta ternyata kosong karena barisnya baru saja
   * dihapus, isinya diambil ulang dari halaman terakhir yang masih ada.
   */
  const load = useCallback(async (page: number) => {
    setLoading(true);
    try {
      let hasil = unwrapList<Announcement>(
        await browserClient().GET('/api/v1/admin/announcements', {
          params: { query: { page, pageSize: UKURAN_HALAMAN } },
        }),
      );
      if (hasil.items.length === 0 && page > 1 && hasil.meta.totalPages >= 1) {
        hasil = unwrapList<Announcement>(
          await browserClient().GET('/api/v1/admin/announcements', {
            params: { query: { page: hasil.meta.totalPages, pageSize: UKURAN_HALAMAN } },
          }),
        );
      }
      setItems(hasil.items);
      setHalaman(hasil.meta.page);
      setTotalHalaman(hasil.meta.totalPages);
      setTotal(hasil.meta.total);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Pengumuman gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function run(action: string, task: () => Promise<unknown>, success: string): Promise<boolean> {
    if (busy) return false;
    setBusy(action);
    try {
      await task();
      notifier.success(success);
      await load(halaman);
      return true;
    } catch (caught) {
      void notifier.error('Tindakan gagal dijalankan', {
        text: caught instanceof ApiError ? caught.message : undefined,
        reasons: caught instanceof ApiError ? Object.values(caught.fields ?? {}).flat() : [],
      });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Modal hanya menutup bila benar-benar tersimpan; bila gagal, isian yang
    // sudah diketik tetap ada untuk diperbaiki.
    const ok = await run(editing ? `edit-${editing.id}` : 'create', async () => {
      const bodyPayload = {
        title: title.trim(), body: body.trim(), audience,
        courseId: audience === 'COURSE_LEARNERS' ? courseId : undefined,
        publishedAt: scheduled ? new Date(publishedAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      };
      if (editing) {
        await browserClient().PATCH('/api/v1/admin/announcements/{announcementId}', {
          params: { path: { announcementId: editing.id } }, body: bodyPayload,
        });
      } else {
        await browserClient().POST('/api/v1/admin/announcements', { body: bodyPayload });
      }
        setTitle('');
        setBody('');
        setEndsAt('');
      }, editing ? 'Pengumuman diperbarui.' : 'Draft pengumuman tersimpan.');
    if (ok) {
      setComposeOpen(false);
      setEditing(null);
      // Draft baru berada di halaman pertama karena daftarnya terbaru dulu;
      // `run` sudah memuat ulang halaman yang sedang dibuka.
      if (halaman !== 1) await load(1);
    }
  }

  function edit(item: Announcement) {
    setEditing(item);
    setComposeOpen(false);
    setTitle(item.title);
    setBody(item.body);
    setAudience(item.audience);
    setCourseId(item.course?.id ?? courses[0]?.id ?? '');
    setScheduled(Boolean(item.publishedAt));
    setPublishedAt(item.publishedAt ? toLocalInputValue(new Date(item.publishedAt)) : toLocalInputValue(new Date()));
    setEndsAt(item.endsAt ? toLocalInputValue(new Date(item.endsAt)) : '');
  }

  function closeForm() {
    if (busy !== null) return;
    setComposeOpen(false);
    setEditing(null);
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
          <span className="eyebrow">Pesan baru</span>
          <h2 className="sectionTitle">Tulis pengumuman</h2>
        </div>
        <button className="btn" type="button" disabled={busy !== null} onClick={() => { setEditing(null); setComposeOpen(true); }}>
          Tulis pengumuman
        </button>
      </div>

      {composeOpen || editing ? (
        <Modal
          title={editing ? 'Sunting pengumuman' : 'Tulis pengumuman'}
          description="Sampaikan informasi penting kepada seluruh pengguna atau peserta kursus tertentu."
          busy={busy !== null}
          onClose={closeForm}
        >
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Judul</span>
          <input
            value={title}
            placeholder="Judul pengumuman"
            onChange={(event) => setTitle(event.currentTarget.value)}
            minLength={3}
            maxLength={200}
            required
            disabled={busy !== null}
          />
        </label>
        <label className="field">
          <span>Isi</span>
          <textarea
            value={body}
            placeholder="Tulis isi pengumuman dengan jelas dan ringkas."
            onChange={(event) => setBody(event.currentTarget.value)}
            rows={4}
            maxLength={5000}
            required
            disabled={busy !== null}
          />
        </label>
        <div className="fieldRow">
          <label className="field">
            <span>Ditujukan kepada</span>
            <select
              value={audience}
              onChange={(event) => setAudience(event.currentTarget.value as Audience)}
              disabled={busy !== null}
            >
              <option value="ALL_USERS">Semua pengguna</option>
              <option value="COURSE_LEARNERS">Peserta satu kursus</option>
            </select>
          </label>
          {audience === 'COURSE_LEARNERS' ? (
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
          ) : null}
        </div>
        <label className="checkRow">
          <input
            type="checkbox"
            checked={scheduled}
            onChange={(event) => setScheduled(event.currentTarget.checked)}
            disabled={busy !== null}
          />
          <span>Jadwalkan tampil pada waktu tertentu</span>
        </label>
        <div className="fieldRow">
          {scheduled ? (
            <label className="field">
              <span>Mulai tampil</span>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(event) => setPublishedAt(event.currentTarget.value)}
                disabled={busy !== null}
              />
            </label>
          ) : null}
          <label className="field">
            <span>Berhenti tampil (opsional)</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.currentTarget.value)}
              disabled={busy !== null}
            />
          </label>
        </div>
        <small className="muted">
          Tersimpan sebagai draft. Pelajar baru melihatnya setelah kamu menekan Terbitkan.
        </small>
        <div className="lessonEditActions">
          <button className="btn btnGhost" type="button" disabled={busy !== null} onClick={closeForm}>
            Batal
          </button>
          <button className="btn" type="submit" disabled={busy !== null}>
            {busy === 'create' ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan draft'}
          </button>
        </div>
      </form>
        </Modal>
      ) : null}

      <div className="masterListHead">
        <div>
          <span className="eyebrow">Riwayat konten</span>
          <h2 className="sectionTitle">Daftar pengumuman</h2>
        </div>
        <span className="pill">{total} pengumuman</span>
      </div>
      {loading ? <p className="stageNote">Memuat…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="stageNote">Belum ada pengumuman.</p>
      ) : null}
      {!loading && items.length > 0 ? (
        <ul className="stack masterRecordList">
          {items.map((item) => {
            const pill = STATUS_PILL[item.status];
            return (
              <li key={item.id} className="card masterRecordCard">
                <div className="rowBetween">
                  <div>
                    <strong>{item.title}</strong>
                    <small className="muted">
                      {AUDIENCE_LABEL[item.audience]}
                      {item.course ? ` · ${item.course.title}` : ''} · {item.creator.fullName} ·{' '}
                      {item._count.readState} dibaca
                    </small>
                  </div>
                  <span className={pill.className}>{pill.label}</span>
                </div>
                <p>{item.body}</p>
                <small className="muted">
                  Tampil: {formatDate(item.publishedAt)} · Berakhir: {formatDate(item.endsAt)}
                </small>
                {/* Diringkas menjadi satu tombol, sebentuk dengan daftar kursus
                    dan daftar pengguna. */}
                <ActionMenu label="Aksi">
                  <button className="btnTiny" type="button" disabled={busy !== null} onClick={() => edit(item)}>
                    Sunting
                  </button>
                  {item.status === 'DRAFT' ? (
                    <button
                      className="btnTiny"
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(
                          `publish-${item.id}`,
                          () =>
                            browserClient().POST(
                              '/api/v1/admin/announcements/{announcementId}/publish',
                              { params: { path: { announcementId: item.id } } },
                            ),
                          'Pengumuman diterbitkan.',
                        )
                      }
                    >
                      Terbitkan
                    </button>
                  ) : null}
                  {item.status === 'PUBLISHED' ? (
                    <button
                      className="btnTiny"
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(
                          `archive-${item.id}`,
                          () =>
                            browserClient().POST(
                              '/api/v1/admin/announcements/{announcementId}/archive',
                              { params: { path: { announcementId: item.id } } },
                            ),
                          'Pengumuman diarsipkan.',
                        )
                      }
                    >
                      Arsipkan
                    </button>
                  ) : null}
                  <button
                    className="btnGhost btnSmall"
                    type="button"
                    disabled={busy !== null}
                    onClick={async () => {
                      const lanjut = await notifier.confirm(`Hapus "${item.title}"?`, {
                        text: 'Tindakan ini permanen dan tidak dapat dibatalkan.',
                        confirmLabel: 'Hapus',
                        danger: true,
                      });
                      if (!lanjut) return;
                      void run(
                        `delete-${item.id}`,
                        () =>
                          browserClient()
                            .DELETE('/api/v1/admin/announcements/{announcementId}', {
                              params: { path: { announcementId: item.id } },
                            })
                            .then(ensureSuccess),
                        'Pengumuman dihapus.',
                      );
                    }}
                  >
                    Hapus
                  </button>
                </ActionMenu>
              </li>
            );
          })}
        </ul>
      ) : null}

      {totalHalaman > 1 ? (
        <nav className="toolbar enrollmentPager" aria-label="Navigasi halaman pengumuman">
          <button
            className="btn btnGhost"
            type="button"
            disabled={halaman <= 1 || loading}
            onClick={() => void load(halaman - 1)}
          >
            Sebelumnya
          </button>
          <span className="pill">
            Halaman {halaman} dari {totalHalaman}
          </span>
          <button
            className="btn btnGhost"
            type="button"
            disabled={halaman >= totalHalaman || loading}
            onClick={() => void load(halaman + 1)}
          >
            Berikutnya
          </button>
        </nav>
      ) : null}
    </section>
  );
}
