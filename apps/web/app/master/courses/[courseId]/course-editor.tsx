'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, readCsrfToken, unwrap } from '../../../lib/browser-api';
import { StatusPill } from '../../../components/status-pill';

type CourseDetail = Schemas['AdminCourseDetailDto'];
type Module = Schemas['AdminModuleWithLessonsDto'];

const CONTENT_TYPES = [
  { value: 'TEXT', label: 'Teks' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'PDF', label: 'PDF' },
  { value: 'EXTERNAL_LINK', label: 'Tautan luar' },
] as const;

export function CourseEditor({ course }: { course: CourseDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);

  /**
   * Menjalankan satu mutation.
   *
   * `busy` menyimpan nama aksi yang sedang berjalan, sehingga hanya tombol
   * bersangkutan yang dinonaktifkan dan klik ganda tidak mengirim dua kali.
   */
  async function run(action: string, fn: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(action);
    setError(null);
    setReasons([]);

    try {
      await fn();
      router.refresh();
      return true;
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        // Aturan terbit mengembalikan seluruh alasan sekaligus.
        if (caught.fields?.course) setReasons(caught.fields.course);
      } else {
        setError('Tidak dapat menghubungi server. Perubahan belum tersimpan.');
      }
      return false;
    } finally {
      setBusy(null);
    }
  }

  const client = () => browserClient();

  const publish = () =>
    run('publish', async () =>
      unwrap(
        await client().POST('/api/v1/admin/courses/{courseId}/publish', {
          params: { path: { courseId: course.id } },
        }),
      ),
    );

  const archive = () =>
    run('archive', async () =>
      unwrap(
        await client().POST('/api/v1/admin/courses/{courseId}/archive', {
          params: { path: { courseId: course.id } },
        }),
      ),
    );

  const addModule = (title: string) =>
    run('add-module', async () =>
      unwrap(
        await client().POST('/api/v1/admin/courses/{courseId}/modules', {
          params: { path: { courseId: course.id } },
          body: { title },
        }),
      ),
    );

  const removeModule = (moduleId: string) =>
    run(`del-module-${moduleId}`, async () => {
      const result = await client().DELETE('/api/v1/admin/modules/{moduleId}', {
        params: { path: { moduleId } },
      });
      if (result.error) throw result.error;
    });

  const addLesson = (
    moduleId: string,
    body: { title: string; contentType: (typeof CONTENT_TYPES)[number]['value']; isRequired: boolean },
  ) =>
    run(`add-lesson-${moduleId}`, async () =>
      unwrap(
        await client().POST('/api/v1/admin/modules/{moduleId}/lessons', {
          params: { path: { moduleId } },
          body,
        }),
      ),
    );

  const removeLesson = (lessonId: string) =>
    run(`del-lesson-${lessonId}`, async () => {
      const result = await client().DELETE('/api/v1/admin/lessons/{lessonId}', {
        params: { path: { lessonId } },
      });
      if (result.error) throw result.error;
    });

  const uploadVideo = (lessonId: string, title: string, file: File) =>
    run(`upload-video-${lessonId}`, async () => {
      if (file.type !== 'video/mp4' || !file.name.toLowerCase().endsWith('.mp4')) {
        throw new ApiError('VALIDATION_ERROR', 422, 'Pilih file MP4.');
      }
      const intent = unwrap(
        await client().POST('/api/v1/admin/videos/upload-intents', {
          body: {
            lessonId,
            title,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          },
        }),
      ) as unknown as { uploadUrl: string; method: string };
      const csrf = readCsrfToken();
      const response = await fetch(intent.uploadUrl, {
        method: intent.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'video/mp4',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: file,
      });
      if (!response.ok) throw new Error('Upload video gagal.');
    });

  const moveModule = (index: number, direction: -1 | 1) => {
    const ids = course.modules.map((m) => m.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return Promise.resolve(false);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];

    return run('reorder-modules', async () =>
      unwrap(
        await client().PUT('/api/v1/admin/courses/{courseId}/modules/order', {
          params: { path: { courseId: course.id } },
          body: { ids },
        }),
      ),
    );
  };

  const moveLesson = (courseModule: Module, index: number, direction: -1 | 1) => {
    const ids = courseModule.lessons.map((l) => l.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return Promise.resolve(false);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];

    return run(`reorder-lessons-${courseModule.id}`, async () =>
      unwrap(
        await client().PUT('/api/v1/admin/modules/{moduleId}/lessons/order', {
          params: { path: { moduleId: courseModule.id } },
          body: { ids },
        }),
      ),
    );
  };

  const requiredLessons = course.modules
    .filter((m) => m.isActive)
    .flatMap((m) => m.lessons)
    .filter((l) => l.isActive && l.isRequired).length;

  return (
    <>
      <div className="pageHead">
        <div className="pageHeadMain">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="pageTitle">{course.title}</h1>
            <StatusPill status={course.status} />
          </div>
          <p className="pageSub">
            /{course.slug} · {course.modules.length} bagian ·{' '}
            {course.modules.reduce((n, m) => n + m.lessons.length, 0)} pelajaran ·{' '}
            {requiredLessons} wajib
          </p>
        </div>

        <div className="inlineActions">
          {course.status !== 'PUBLISHED' ? (
            <button className="btn" onClick={publish} disabled={busy !== null}>
              {busy === 'publish' ? 'Menerbitkan…' : 'Terbitkan'}
            </button>
          ) : (
            <button className="btn btnGhost" onClick={archive} disabled={busy !== null}>
              {busy === 'archive' ? 'Mengarsipkan…' : 'Arsipkan'}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="notice noticeError" role="alert" style={{ marginBottom: 18 }}>
          <div>
            {error}
            {reasons.length > 0 ? (
              <ul className="reasonList">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {course.status === 'DRAFT' ? (
        <p className="notice noticeInfo" style={{ marginBottom: 18 }} role="status">
          Kursus ini masih draf, jadi belum terlihat oleh pelajar.
        </p>
      ) : null}

      <section className="card panel">
        <div className="panelHead">
          <h2>Bagian dan pelajaran</h2>
        </div>

        {course.modules.length === 0 ? (
          <p className="pageSub" style={{ margin: '0 0 14px' }}>
            Belum ada bagian. Tambahkan bagian pertama untuk mulai menyusun materi.
          </p>
        ) : (
          course.modules.map((courseModule, moduleIndex) => (
            <article key={courseModule.id} className="moduleCard">
              <div className="moduleHead">
                <h3>
                  {moduleIndex + 1}. {courseModule.title}
                </h3>
                {!courseModule.isActive ? <StatusPill status="INACTIVE" /> : null}
                <span className="cellSub" style={{ margin: 0 }}>
                  {courseModule.lessons.length} pelajaran
                </span>
                <span className="inlineActions">
                  <button
                    className="btnTiny"
                    onClick={() => moveModule(moduleIndex, -1)}
                    disabled={busy !== null || moduleIndex === 0}
                    aria-label={`Naikkan bagian ${courseModule.title}`}
                  >
                    ↑
                  </button>
                  <button
                    className="btnTiny"
                    onClick={() => moveModule(moduleIndex, 1)}
                    disabled={busy !== null || moduleIndex === course.modules.length - 1}
                    aria-label={`Turunkan bagian ${courseModule.title}`}
                  >
                    ↓
                  </button>
                  <button
                    className="btnTiny btnDanger"
                    onClick={() => removeModule(courseModule.id)}
                    disabled={busy !== null}
                  >
                    Hapus
                  </button>
                </span>
              </div>

              <div className="moduleBody">
                {courseModule.lessons.length === 0 ? (
                  <p className="lessonLine" style={{ color: 'var(--muted)' }}>
                    Belum ada pelajaran di bagian ini.
                  </p>
                ) : (
                  courseModule.lessons.map((lesson, lessonIndex) => (
                    <div key={lesson.id} className="lessonLine">
                      <span className="lessonTitle">
                        {lessonIndex + 1}. {lesson.title}
                      </span>
                      <span className="pill">{contentLabel(lesson.contentType)}</span>
                      {lesson.isRequired ? (
                        <span className="pill pillAccent">Wajib</span>
                      ) : (
                        <span className="pill">Opsional</span>
                      )}
                      {lesson.contentType === 'VIDEO' ? (
                        <label className="btnTiny">
                          {busy === `upload-video-${lesson.id}` ? 'Mengunggah…' : 'Unggah MP4'}
                          <input
                            type="file"
                            accept="video/mp4,.mp4"
                            hidden
                            disabled={busy !== null}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              if (file) void uploadVideo(lesson.id, lesson.title, file);
                              event.currentTarget.value = '';
                            }}
                          />
                        </label>
                      ) : null}
                      <span className="inlineActions">
                        <button
                          className="btnTiny"
                          onClick={() => moveLesson(courseModule, lessonIndex, -1)}
                          disabled={busy !== null || lessonIndex === 0}
                          aria-label={`Naikkan pelajaran ${lesson.title}`}
                        >
                          ↑
                        </button>
                        <button
                          className="btnTiny"
                          onClick={() => moveLesson(courseModule, lessonIndex, 1)}
                          disabled={busy !== null || lessonIndex === courseModule.lessons.length - 1}
                          aria-label={`Turunkan pelajaran ${lesson.title}`}
                        >
                          ↓
                        </button>
                        <button
                          className="btnTiny btnDanger"
                          onClick={() => removeLesson(lesson.id)}
                          disabled={busy !== null}
                        >
                          Hapus
                        </button>
                      </span>
                    </div>
                  ))
                )}

                <AddLessonForm
                  disabled={busy !== null}
                  onAdd={(body) => addLesson(courseModule.id, body)}
                />
              </div>
            </article>
          ))
        )}

        <AddModuleForm disabled={busy !== null} onAdd={addModule} />
      </section>
    </>
  );
}

function AddModuleForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (title: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3) return;
    const ok = await onAdd(title.trim());
    if (ok) setTitle('');
  }

  return (
    <form className="addForm" onSubmit={submit} style={{ borderTop: 0, paddingLeft: 0, paddingRight: 0 }}>
      <label className="srOnly" htmlFor="new-module">
        Judul bagian baru
      </label>
      <input
        id="new-module"
        placeholder="Judul bagian baru, minimal 3 karakter"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={disabled}
      />
      <button className="btn" type="submit" disabled={disabled || title.trim().length < 3}>
        Tambah bagian
      </button>
    </form>
  );
}

function AddLessonForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (body: {
    title: string;
    contentType: (typeof CONTENT_TYPES)[number]['value'];
    isRequired: boolean;
  }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]['value']>('TEXT');
  const [isRequired, setIsRequired] = useState(true);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3) return;
    const ok = await onAdd({ title: title.trim(), contentType, isRequired });
    if (ok) setTitle('');
  }

  return (
    <form className="addForm" onSubmit={submit}>
      <label className="srOnly" htmlFor={`lesson-${contentType}`}>
        Judul pelajaran baru
      </label>
      <input
        placeholder="Judul pelajaran baru"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={disabled}
      />
      <select
        value={contentType}
        onChange={(event) => setContentType(event.target.value as typeof contentType)}
        disabled={disabled}
        aria-label="Jenis materi"
      >
        {CONTENT_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      <label className="checkRow">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(event) => setIsRequired(event.target.checked)}
          disabled={disabled}
        />
        Wajib
      </label>
      <button className="btnTiny" type="submit" disabled={disabled || title.trim().length < 3}>
        Tambah
      </button>
    </form>
  );
}

function contentLabel(value: string): string {
  return CONTENT_TYPES.find((type) => type.value === value)?.label ?? value;
}
