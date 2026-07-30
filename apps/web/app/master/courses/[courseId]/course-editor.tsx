'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Schemas } from '@lms/api-client';
import {
  ApiError,
  browserApiUrl,
  browserClient,
  readCsrfToken,
  unwrap,
} from '../../../lib/browser-api';
import { ChevronDown, ChevronUp, Edit, Trash } from '../../../components/icons';
import { StatusPill } from '../../../components/status-pill';

type CourseDetail = Schemas['AdminCourseDetailDto'];
type Module = Schemas['AdminModuleWithLessonsDto'];
type Lesson = Schemas['AdminLessonDto'];

const CONTENT_TYPES = [
  { value: 'TEXT', label: 'Teks' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'PDF', label: 'PDF' },
  { value: 'EXTERNAL_LINK', label: 'Tautan luar' },
] as const;

const COMPLETION_RULES = [
  { value: 'MANUAL', label: 'Ditandai manual' },
  { value: 'OPENED', label: 'Selesai saat dibuka' },
  { value: 'MINIMUM_ACTIVE_SECONDS', label: 'Durasi aktif minimum' },
  { value: 'VIDEO_PERCENTAGE', label: 'Persentase video' },
] as const;

type LessonUpdateInput = {
  title: string;
  description: string;
  contentType: (typeof CONTENT_TYPES)[number]['value'];
  textContent: string;
  externalUrl: string;
  estimatedMinutes: number;
  isRequired: boolean;
  isPreview: boolean;
  isActive: boolean;
  completionRule: (typeof COMPLETION_RULES)[number]['value'];
};

type UploadState = {
  lessonId: string;
  fileName: string;
  percent: number;
  status: 'UPLOADING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  message: string;
};

export function CourseEditor({ course }: { course: CourseDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);

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

  const updateLesson = (
    lessonId: string,
    body: LessonUpdateInput,
  ) =>
    run(`edit-lesson-${lessonId}`, async () =>
      unwrap(
        await client().PATCH('/api/v1/admin/lessons/{lessonId}', {
          params: { path: { lessonId } },
          body,
        }),
      ),
    );

  async function uploadVideo(lessonId: string, title: string, file: File) {
    if (busy) return;
    const action = `upload-video-${lessonId}`;
    setBusy(action);
    setError(null);
    setReasons([]);
    setUpload({
      lessonId,
      fileName: file.name,
      percent: 0,
      status: 'UPLOADING',
      message: 'Menyiapkan upload…',
    });

    try {
      if (!file.name.toLowerCase().endsWith('.mp4')) {
        throw new ApiError('VALIDATION_ERROR', 422, 'Pilih file dengan ekstensi .mp4.');
      }
      if (file.size < 1) {
        throw new ApiError('VALIDATION_ERROR', 422, 'File video kosong.');
      }

      // Sebagian browser/OS memberi `file.type` kosong atau `application/octet-stream`
      // untuk MP4. Ekstensi dinormalisasi di sini; server tetap memeriksa signature
      // ISO-BMFF `ftyp` sebelum menandai video tersedia.
      const intent = unwrap(
        await client().POST('/api/v1/admin/videos/upload-intents', {
          body: {
            lessonId,
            title,
            fileName: file.name,
            mimeType: 'video/mp4',
            sizeBytes: file.size,
          },
        }),
      ) as unknown as { uploadUrl: string; method: string };

      await uploadFile(intent.uploadUrl, intent.method, file, (percent) => {
        setUpload({
          lessonId,
          fileName: file.name,
          percent,
          status: percent >= 100 ? 'PROCESSING' : 'UPLOADING',
          message: percent >= 100 ? 'Memvalidasi dan menyimpan video…' : `Mengunggah ${percent}%`,
        });
      });

      setUpload({
        lessonId,
        fileName: file.name,
        percent: 100,
        status: 'SUCCESS',
        message: 'Video berhasil diunggah dan siap diputar.',
      });
      router.refresh();
    } catch (caught) {
      const message = uploadErrorMessage(caught);
      setUpload({
        lessonId,
        fileName: file.name,
        percent: 0,
        status: 'ERROR',
        message,
      });
    } finally {
      setBusy(null);
    }
  }

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
                    className="iconAction"
                    onClick={() => moveModule(moduleIndex, -1)}
                    disabled={busy !== null || moduleIndex === 0}
                    aria-label={`Naikkan bagian ${courseModule.title}`}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    className="iconAction"
                    onClick={() => moveModule(moduleIndex, 1)}
                    disabled={busy !== null || moduleIndex === course.modules.length - 1}
                    aria-label={`Turunkan bagian ${courseModule.title}`}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    className="iconAction btnDanger"
                    onClick={() => removeModule(courseModule.id)}
                    disabled={busy !== null}
                    aria-label={`Hapus bagian ${courseModule.title}`}
                  >
                    <Trash size={16} />
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
                    <div key={lesson.id} className="lessonAdminItem">
                      <div className="lessonLine">
                        <span className="lessonIndex">{lessonIndex + 1}</span>
                        <span className="lessonTitle">
                          <strong>{lesson.title}</strong>
                          <small>
                            {lesson.description || `${lesson.estimatedMinutes} menit`}
                          </small>
                        </span>
                        <span className="pill">{contentLabel(lesson.contentType)}</span>
                        {lesson.isRequired ? (
                          <span className="pill pillAccent">Wajib</span>
                        ) : (
                          <span className="pill">Opsional</span>
                        )}
                        {lesson.contentType === 'VIDEO' ? (
                          <label className="btnTiny">
                            {busy === `upload-video-${lesson.id}` ? 'Sedang mengunggah…' : 'Unggah MP4'}
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
                        <span className="inlineActions lessonActions">
                          <button
                            className="iconAction"
                            onClick={() =>
                              setEditingLessonId((current) =>
                                current === lesson.id ? null : lesson.id,
                              )
                            }
                            disabled={busy !== null}
                            aria-label={`Edit pelajaran ${lesson.title}`}
                            aria-expanded={editingLessonId === lesson.id}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="iconAction"
                            onClick={() => moveLesson(courseModule, lessonIndex, -1)}
                            disabled={busy !== null || lessonIndex === 0}
                            aria-label={`Naikkan pelajaran ${lesson.title}`}
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            className="iconAction"
                            onClick={() => moveLesson(courseModule, lessonIndex, 1)}
                            disabled={
                              busy !== null || lessonIndex === courseModule.lessons.length - 1
                            }
                            aria-label={`Turunkan pelajaran ${lesson.title}`}
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            className="iconAction btnDanger"
                            onClick={() => removeLesson(lesson.id)}
                            disabled={busy !== null}
                            aria-label={`Hapus pelajaran ${lesson.title}`}
                          >
                            <Trash size={16} />
                          </button>
                        </span>
                      </div>
                      {upload?.lessonId === lesson.id &&
                      (upload.status === 'UPLOADING' || upload.status === 'PROCESSING') ? (
                        <div className="videoUploadProgress" role="status" aria-live="polite">
                          <div className="videoUploadMeta">
                            <span>{upload.fileName}</span>
                            <strong>{upload.status === 'PROCESSING' ? 'Memproses' : `${upload.percent}%`}</strong>
                          </div>
                          <div
                            className="videoUploadTrack"
                            role="progressbar"
                            aria-label={`Upload ${upload.fileName}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={upload.percent}
                          >
                            <span style={{ width: `${upload.percent}%` }} />
                          </div>
                          <small>{upload.message}</small>
                        </div>
                      ) : null}
                      {editingLessonId === lesson.id ? (
                        <LessonEditForm
                          lesson={lesson}
                          disabled={busy !== null}
                          onCancel={() => setEditingLessonId(null)}
                          onSave={async (body) => {
                            const ok = await updateLesson(lesson.id, body);
                            if (ok) setEditingLessonId(null);
                            return ok;
                          }}
                        />
                      ) : null}
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

      {upload && (upload.status === 'SUCCESS' || upload.status === 'ERROR') ? (
        <div
          className={`uploadToast ${
            upload.status === 'SUCCESS' ? 'uploadToastSuccess' : 'uploadToastError'
          }`}
          role={upload.status === 'ERROR' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span className="uploadToastIcon" aria-hidden="true">
            {upload.status === 'SUCCESS' ? '✓' : '!'}
          </span>
          <div>
            <strong>{upload.status === 'SUCCESS' ? 'Upload selesai' : 'Upload gagal'}</strong>
            <p>{upload.message}</p>
            <small>{upload.fileName}</small>
          </div>
          <button type="button" onClick={() => setUpload(null)} aria-label="Tutup notifikasi">
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}

function uploadFile(
  uploadUrl: string,
  method: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const absoluteUrl = new URL(uploadUrl, `${browserApiUrl().replace(/\/$/, '')}/`).toString();
    request.open(method, absoluteUrl);
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', 'video/mp4');
    const csrf = readCsrfToken();
    if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || event.total < 1) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(xhrApiError(request));
    });
    request.addEventListener('error', () => {
      reject(new ApiError('NETWORK_ERROR', 0, 'Koneksi terputus saat mengunggah video.'));
    });
    request.addEventListener('abort', () => {
      reject(new ApiError('NETWORK_ERROR', 0, 'Upload video dibatalkan.'));
    });
    request.send(file);
  });
}

function xhrApiError(request: XMLHttpRequest): ApiError {
  try {
    const payload = JSON.parse(request.responseText) as {
      error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
        requestId?: string;
      };
    };
    const body = payload.error;
    if (body) {
      return new ApiError(
        (body.code ?? 'INTERNAL_ERROR') as ConstructorParameters<typeof ApiError>[0],
        request.status,
        body.message ?? 'Upload video gagal.',
        body.fields,
        body.requestId,
      );
    }
  } catch {
    // Respons non-JSON ditangani dengan pesan generik di bawah.
  }
  return new ApiError('INTERNAL_ERROR', request.status, 'Server menolak upload video.');
}

function uploadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Upload gagal. Periksa koneksi dan coba lagi.';
  }
  const details = error.fields ? Object.values(error.fields).flat().filter(Boolean) : [];
  return details.length > 0 ? details.join(' ') : error.message;
}

function LessonEditForm({
  lesson,
  disabled,
  onCancel,
  onSave,
}: {
  lesson: Lesson;
  disabled: boolean;
  onCancel: () => void;
  onSave: (body: LessonUpdateInput) => Promise<boolean>;
}) {
  const [contentType, setContentType] = useState<
    (typeof CONTENT_TYPES)[number]['value']
  >(lesson.contentType);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSave({
      title: String(form.get('title') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      contentType,
      textContent: contentType === 'TEXT' ? String(form.get('textContent') ?? '') : '',
      externalUrl:
        contentType === 'EXTERNAL_LINK' || contentType === 'PDF'
          ? String(form.get('externalUrl') ?? '').trim()
          : '',
      estimatedMinutes: Number(form.get('estimatedMinutes') ?? 0),
      isRequired: form.get('isRequired') === 'on',
      isPreview: form.get('isPreview') === 'on',
      isActive: form.get('isActive') === 'on',
      completionRule: String(
        form.get('completionRule') ?? 'MANUAL',
      ) as (typeof COMPLETION_RULES)[number]['value'],
    });
  }

  return (
    <form className="lessonEditForm" onSubmit={submit}>
      <div className="lessonEditHead">
        <div>
          <strong>Edit materi</strong>
          <p>Isi konten yang akan dibaca atau dibuka oleh Pelajar.</p>
        </div>
      </div>
      <div className="lessonEditGrid">
        <div className="field">
          <label htmlFor={`lesson-title-${lesson.id}`}>Judul</label>
          <input
            id={`lesson-title-${lesson.id}`}
            name="title"
            defaultValue={lesson.title}
            required
            minLength={3}
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor={`lesson-type-${lesson.id}`}>Jenis materi</label>
          <select
            id={`lesson-type-${lesson.id}`}
            value={contentType}
            onChange={(event) => setContentType(event.target.value as typeof contentType)}
            disabled={disabled}
          >
            {CONTENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div className="field lessonEditFull">
          <label htmlFor={`lesson-description-${lesson.id}`}>Deskripsi singkat</label>
          <textarea
            id={`lesson-description-${lesson.id}`}
            name="description"
            defaultValue={lesson.description ?? ''}
            maxLength={2000}
            disabled={disabled}
          />
        </div>
        {contentType === 'TEXT' ? (
          <div className="field lessonEditFull">
            <label htmlFor={`lesson-content-${lesson.id}`}>Isi artikel atau materi teks</label>
            <textarea
              className="lessonContentInput"
              id={`lesson-content-${lesson.id}`}
              name="textContent"
              defaultValue={lesson.textContent ?? ''}
              maxLength={50000}
              placeholder="Tulis materi pembelajaran di sini…"
              disabled={disabled}
            />
            <span className="fieldHint">Maksimal 50.000 karakter.</span>
          </div>
        ) : null}
        {contentType === 'EXTERNAL_LINK' || contentType === 'PDF' ? (
          <div className="field lessonEditFull">
            <label htmlFor={`lesson-url-${lesson.id}`}>
              {contentType === 'PDF' ? 'URL dokumen PDF' : 'URL tujuan'}
            </label>
            <input
              id={`lesson-url-${lesson.id}`}
              name="externalUrl"
              type="url"
              defaultValue={lesson.externalUrl ?? ''}
              placeholder="https://"
              disabled={disabled}
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor={`lesson-duration-${lesson.id}`}>Estimasi durasi (menit)</label>
          <input
            id={`lesson-duration-${lesson.id}`}
            name="estimatedMinutes"
            type="number"
            min={0}
            max={10000}
            defaultValue={lesson.estimatedMinutes}
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor={`lesson-completion-${lesson.id}`}>Aturan selesai</label>
          <select
            id={`lesson-completion-${lesson.id}`}
            name="completionRule"
            defaultValue={lesson.completionRule}
            disabled={disabled}
          >
            {COMPLETION_RULES.map((rule) => (
              <option key={rule.value} value={rule.value}>{rule.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="lessonOptions">
        <label className="checkRow">
          <input name="isRequired" type="checkbox" defaultChecked={lesson.isRequired} disabled={disabled} />
          Wajib
        </label>
        <label className="checkRow">
          <input name="isPreview" type="checkbox" defaultChecked={lesson.isPreview} disabled={disabled} />
          Bisa dipreview
        </label>
        <label className="checkRow">
          <input name="isActive" type="checkbox" defaultChecked={lesson.isActive} disabled={disabled} />
          Aktif
        </label>
      </div>
      <div className="lessonEditActions">
        <button className="btn btnGhost" type="button" onClick={onCancel} disabled={disabled}>
          Batal
        </button>
        <button className="btn" type="submit" disabled={disabled}>
          {disabled ? 'Menyimpan…' : 'Simpan materi'}
        </button>
      </div>
    </form>
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
