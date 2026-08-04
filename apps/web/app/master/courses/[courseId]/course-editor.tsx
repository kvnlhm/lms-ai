'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../../components/notifier';
import { ApiError, browserClient, ensureSuccess, unwrap } from '../../../lib/browser-api';
import { uploadMaterial } from '../../../lib/material-upload';
import {
  attachToLesson,
  uploadErrorMessage,
  uploadToLibrary,
} from '../../../lib/video-upload';
import { ChevronDown, ChevronUp, Edit, Plus, Trash } from '../../../components/icons';
import { Modal } from '../../../components/modal';
import { VideoLibraryPicker } from '../../../components/video-library-picker';
import { StatusPill } from '../../../components/status-pill';
import { QuizEditor } from './quiz-editor';

type CourseDetail = Schemas['AdminCourseDetailDto'];
type Module = Schemas['AdminModuleWithLessonsDto'];
type Lesson = Schemas['AdminLessonDto'];

const CONTENT_TYPES = [
  { value: 'TEXT', label: 'Teks' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'PDF', label: 'PDF' },
  { value: 'EXTERNAL_LINK', label: 'Tautan luar' },
  { value: 'QUIZ', label: 'Kuis' },
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
  completionVideoPercentage?: number;
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
  const notifier = useNotifier();
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  // Formulir tambah kini tinggal di dalam modal, jadi yang disimpan adalah
  // bagian mana yang sedang ditambahi — bukan lagi terbuka atau tidak.
  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [youtubeLessonId, setYoutubeLessonId] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [bunnyLessonId, setBunnyLessonId] = useState<string | null>(null);
  const [bunnySource, setBunnySource] = useState('');
  const [pickerLesson, setPickerLesson] = useState<{ id: string; title: string } | null>(null);
  const [quizLessonId, setQuizLessonId] = useState<string | null>(null);

  /**
   * Menjalankan satu mutation.
   *
   * `busy` menyimpan nama aksi yang sedang berjalan, sehingga hanya tombol
   * bersangkutan yang dinonaktifkan dan klik ganda tidak mengirim dua kali.
   */
  async function run(action: string, fn: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(action);

    try {
      await fn();
      router.refresh();
      return true;
    } catch (caught) {
      if (caught instanceof ApiError) {
        void notifier.error('Perubahan belum tersimpan', {
          text: caught.message,
          // Aturan terbit mengembalikan seluruh alasan sekaligus.
          reasons: caught.fields?.course ?? [],
        });
      } else {
        void notifier.error('Tidak dapat menghubungi server', {
          text: 'Perubahan belum tersimpan. Periksa koneksimu lalu coba lagi.',
        });
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

  /**
   * Penghapusan permanen, hanya untuk kursus yang belum pernah dipakai.
   *
   * Tidak memakai `run` karena halaman ini ikut hilang bersama kursusnya:
   * `router.refresh()` sesudahnya akan memuat ulang halaman yang sudah tidak
   * ada. Karena itu kepindahannya ditentukan di sini.
   *
   * Server tetap pemegang aturannya. Kursus yang sudah memiliki enrollment
   * ditolak dengan 409 dan diarahkan ke arsip, supaya riwayat belajar tidak
   * ikut terhapus.
   */
  async function hapusKursus() {
    if (busy) return;
    const lanjut = await notifier.confirm(`Hapus kursus "${course.title}"?`, {
      text:
        'Seluruh bagian, pelajaran, kuis, dan video di dalamnya ikut terhapus permanen. ' +
        'Untuk kursus yang sudah pernah dipakai pelajar, gunakan arsip.',
      confirmLabel: 'Hapus permanen',
      danger: true,
    });
    if (!lanjut) return;

    await jalankanHapus(false);
  }

  /**
   * Mengirim permintaan hapus, dan menawarkan penghapusan paksa bila server
   * menolak karena kursusnya sudah punya enrollment.
   *
   * Peringatannya datang dari server, bukan disalin ke sini — kalau aturannya
   * berubah kelak, teks yang dibaca Master ikut berubah dengan sendirinya.
   */
  async function jalankanHapus(force: boolean) {
    setBusy('delete');
    try {
      ensureSuccess(
        await client().DELETE('/api/v1/admin/courses/{courseId}', {
          params: { path: { courseId: course.id }, query: force ? { force: true } : {} },
        }),
      );
      router.replace('/master/courses');
      router.refresh();
      return;
    } catch (caught) {
      setBusy(null);

      const terpakai = caught instanceof ApiError && caught.status === 409;
      if (terpakai && !force) {
        const tetap = await notifier.confirm('Tetap hapus kursus ini?', {
          text:
            `${caught.message} Bila diteruskan, seluruh pendaftaran pelajar pada kursus ini ` +
            'ikut terhapus permanen beserta progres belajar dan percobaan kuisnya. ' +
            'Tidak ada cara mengembalikannya selain dari backup.',
          confirmLabel: 'Hapus berikut riwayatnya',
          cancelLabel: 'Batal',
          danger: true,
        });
        if (tetap) await jalankanHapus(true);
        return;
      }

      void notifier.error('Kursus tidak dapat dihapus', {
        text:
          caught instanceof ApiError
            ? caught.message
            : 'Tidak dapat menghubungi server. Kursus belum terhapus.',
      });
    }
  }

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
    run(`del-module-${moduleId}`, async () =>
      ensureSuccess(
        await client().DELETE('/api/v1/admin/modules/{moduleId}', {
          params: { path: { moduleId } },
        }),
      ),
    );

  const updateModule = (moduleId: string, title: string) =>
    run(`edit-module-${moduleId}`, async () =>
      unwrap(
        await client().PATCH('/api/v1/admin/modules/{moduleId}', {
          params: { path: { moduleId } },
          body: { title },
        }),
      ),
    );

  const addLesson = (
    moduleId: string,
    body: LessonUpdateInput,
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
    run(`del-lesson-${lessonId}`, async () =>
      ensureSuccess(
        await client().DELETE('/api/v1/admin/lessons/{lessonId}', {
          params: { path: { lessonId } },
        }),
      ),
    );

  async function confirmRemoveModule(courseModule: Module) {
    const jumlah = courseModule.lessons.length;
    const lanjut = await notifier.confirm('Hapus bagian?', {
      text:
        `"${courseModule.title}" akan dihapus permanen.` +
        (jumlah > 0 ? ` ${jumlah} pelajaran di dalamnya juga akan dihapus.` : '') +
        ' Tindakan ini tidak dapat dibatalkan.',
      confirmLabel: 'Hapus permanen',
      danger: true,
    });
    if (lanjut) await removeModule(courseModule.id);
  }

  async function confirmRemoveLesson(lesson: Lesson) {
    const lanjut = await notifier.confirm('Hapus pelajaran?', {
      text: `"${lesson.title}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Hapus permanen',
      danger: true,
    });
    if (lanjut) await removeLesson(lesson.id);
  }

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

  async function linkYoutube(lessonId: string, title: string) {
    if (busy) return;
    const url = youtubeUrl.trim();
    if (!url) {
      void notifier.error('Tautan belum diisi', {
        text: 'Tempel tautan YouTube terlebih dahulu.',
      });
      return;
    }
    setBusy(`youtube-${lessonId}`);
    try {
      // Dua langkah sejak video menjadi barang perpustakaan: tautannya masuk
      // perpustakaan dulu, lalu dipasang pada pelajaran ini.
      const asset = unwrap(
        await client().POST('/api/v1/admin/videos/youtube', {
          body: { title, url },
        }),
  );
      unwrap(
        await client().PUT('/api/v1/admin/lessons/{lessonId}/video', {
          params: { path: { lessonId } },
          body: { videoAssetId: asset.videoAssetId },
        }),
      );
      setYoutubeLessonId(null);
      setYoutubeUrl('');
      setUpload({
        lessonId,
        fileName: url,
        percent: 100,
        status: 'SUCCESS',
        message: 'Video YouTube tertaut dan siap diputar.',
      });
      router.refresh();
    } catch (caught) {
      void notifier.error('Tautan YouTube gagal disimpan', {
        text: caught instanceof ApiError ? caught.message : undefined,
        reasons: caught instanceof ApiError ? Object.values(caught.fields ?? {}).flat() : [],
      });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Mendaftarkan video yang sudah diunggah ke Bunny, lalu memasangnya.
   *
   * Berkasnya tidak lewat server ini sama sekali: Master mengunggahnya di
   * dashboard Bunny, dan yang ditempel di sini adalah GUID-nya.
   */
  async function linkBunny(lessonId: string, title: string) {
    if (busy) return;
    const source = bunnySource.trim();
    if (!source) {
      void notifier.error('GUID belum diisi', {
        text: 'Tempel GUID video dari dashboard Bunny terlebih dahulu.',
      });
      return;
    }
    setBusy(`bunny-${lessonId}`);
    try {
      const asset = unwrap<Schemas['CreateBunnyVideoResultDto']>(
        await client().POST('/api/v1/admin/videos/bunny', { body: { source, title } }),
      );
      unwrap(
        await client().PUT('/api/v1/admin/lessons/{lessonId}/video', {
          params: { path: { lessonId } },
          body: { videoAssetId: asset.videoAssetId },
        }),
      );
      setBunnyLessonId(null);
      setBunnySource('');
      setUpload({
        lessonId,
        fileName: asset.title,
        percent: 100,
        status: 'SUCCESS',
        // Video yang masih ditranskode boleh masuk perpustakaan, tetapi belum
        // dapat diputar. Menyebutnya "siap" akan menjadi janji yang keliru.
        message: asset.status === 'AVAILABLE'
          ? 'Video Bunny tertaut dan siap diputar.'
          : 'Video Bunny tertaut, tetapi masih diproses Bunny dan belum dapat diputar.',
      });
      router.refresh();
    } catch (caught) {
      void notifier.error('Video Bunny gagal didaftarkan', {
        text: caught instanceof ApiError ? caught.message : undefined,
        reasons: caught instanceof ApiError ? Object.values(caught.fields ?? {}).flat() : [],
      });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Mengunggah berkas materi PDF pelajaran.
   *
   * Berkasnya disimpan di server kita dan tidak pernah punya URL publik —
   * itulah bedanya dengan menempel tautan Google Drive, yang begitu tersebar
   * tidak dapat ditarik kembali.
   */
  async function unggahMateri(lessonId: string, file: File) {
    if (busy) return;
    setBusy(`material-${lessonId}`);
    setUpload({ lessonId, fileName: file.name, percent: 0, status: 'UPLOADING', message: 'Mengunggah materi…' });
    try {
      await uploadMaterial(lessonId, file, (percent) =>
        setUpload((current) => (current ? { ...current, percent } : current)),
      );
      setUpload({
        lessonId,
        fileName: file.name,
        percent: 100,
        status: 'SUCCESS',
        message: 'Materi terunggah dan hanya dapat dibuka pelajar yang berhak.',
      });
      router.refresh();
    } catch (caught) {
      setUpload({
        lessonId,
        fileName: file.name,
        percent: 0,
        status: 'ERROR',
        message: caught instanceof ApiError ? caught.message : 'Materi gagal diunggah.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function uploadVideo(lessonId: string, title: string, file: File) {
    if (busy) return;
    const action = `upload-video-${lessonId}`;
    setBusy(action);
    setUpload({
      lessonId,
      fileName: file.name,
      percent: 0,
      status: 'UPLOADING',
      message: 'Menyiapkan upload…',
    });

    try {
      const videoAssetId = await uploadToLibrary(file, title, (percent) => {
        setUpload({
          lessonId,
          fileName: file.name,
          percent,
          status: percent >= 100 ? 'PROCESSING' : 'UPLOADING',
          message: percent >= 100 ? 'Memvalidasi dan menyimpan video…' : `Mengunggah ${percent}%`,
        });
      });

      // Berkasnya kini ada di perpustakaan; pemasangan ke pelajaran adalah
      // langkah tersendiri, dan itulah yang membuatnya bisa dipakai ulang.
      await attachToLesson(lessonId, videoAssetId);

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
          <button
            className="btnTiny btnDanger"
            type="button"
            onClick={hapusKursus}
            disabled={busy !== null}
          >
            {busy === 'delete' ? 'Menghapus…' : 'Hapus kursus'}
          </button>
        </div>
      </div>

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
                {editingModuleId === courseModule.id ? (
                  <ModuleTitleForm
                    courseModule={courseModule}
                    moduleNumber={moduleIndex + 1}
                    disabled={busy !== null}
                    onCancel={() => setEditingModuleId(null)}
                    onSave={async (title) => {
                      const ok = await updateModule(courseModule.id, title);
                      if (ok) setEditingModuleId(null);
                      return ok;
                    }}
                  />
                ) : (
                  <h3>
                    {moduleIndex + 1}. {courseModule.title}
                  </h3>
                )}
                {!courseModule.isActive ? <StatusPill status="INACTIVE" /> : null}
                <span className="cellSub" style={{ margin: 0 }}>
                  {courseModule.lessons.length} pelajaran
                </span>
                <span className="inlineActions">
                  <button
                    className="iconAction"
                    onClick={() =>
                      setEditingModuleId((current) =>
                        current === courseModule.id ? null : courseModule.id,
                      )
                    }
                    disabled={busy !== null}
                    aria-label={`Edit nama bagian ${courseModule.title}`}
                    aria-expanded={editingModuleId === courseModule.id}
                  >
                    <Edit size={16} />
                  </button>
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
                    onClick={() =>
                      void confirmRemoveModule(courseModule)
                    }
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
                        {lesson.contentType === 'PDF' ? (
                          <label className="btnTiny">
                            {busy === `material-${lesson.id}` ? 'Sedang mengunggah…' : 'Unggah PDF'}
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              hidden
                              disabled={busy !== null}
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                event.currentTarget.value = '';
                                if (file) void unggahMateri(lesson.id, file);
                              }}
                            />
                          </label>
                        ) : null}
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
                        {lesson.contentType === 'VIDEO' ? (
                          <button
                            className="btnTiny"
                            type="button"
                            disabled={busy !== null}
                            onClick={() => setPickerLesson({ id: lesson.id, title: lesson.title })}
                          >
                            Pilih dari perpustakaan
                          </button>
                        ) : null}
                        {lesson.contentType === 'QUIZ' ? (
                          <button
                            className="btnTiny"
                            type="button"
                            disabled={busy !== null}
                            onClick={() =>
                              setQuizLessonId((current) =>
                                current === lesson.id ? null : lesson.id,
                              )
                            }
                            aria-expanded={quizLessonId === lesson.id}
                          >
                            Susun soal
                          </button>
                        ) : null}
                        {lesson.contentType === 'VIDEO' ? (
                          <button
                            className="btnTiny"
                            type="button"
                            disabled={busy !== null}
                            onClick={() => {
                              setYoutubeUrl('');
                              setYoutubeLessonId((current) =>
                                current === lesson.id ? null : lesson.id,
                              );
                            }}
                            aria-expanded={youtubeLessonId === lesson.id}
                          >
                            Tautkan YouTube
                          </button>
                        ) : null}
                        {lesson.contentType === 'VIDEO' ? (
                          <button
                            className="btnTiny"
                            type="button"
                            disabled={busy !== null}
                            onClick={() => {
                              setBunnySource('');
                              setBunnyLessonId((current) =>
                                current === lesson.id ? null : lesson.id,
                              );
                            }}
                            aria-expanded={bunnyLessonId === lesson.id}
                          >
                            Tautkan Bunny
                          </button>
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
                            onClick={() =>
                              void confirmRemoveLesson(lesson)
                            }
                            disabled={busy !== null}
                            aria-label={`Hapus pelajaran ${lesson.title}`}
                          >
                            <Trash size={16} />
                          </button>
                        </span>
                      </div>
                      {youtubeLessonId === lesson.id ? (
                        <div className="videoUploadProgress">
                          <label className="field">
                            <span>Tautan YouTube (unlisted atau publik)</span>
                            <input
                              type="url"
                              inputMode="url"
                              placeholder="https://www.youtube.com/watch?v=…"
                              value={youtubeUrl}
                              disabled={busy !== null}
                              onChange={(event) => setYoutubeUrl(event.currentTarget.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void linkYoutube(lesson.id, lesson.title);
                                }
                              }}
                            />
                          </label>
                          <small>
                            Video unlisted tidak muncul di pencarian YouTube, tetapi siapa pun yang
                            memegang tautannya tetap dapat menontonnya tanpa membeli kursus.
                          </small>
                          <span className="inlineActions">
                            <button
                              className="btnSecondary btnSmall"
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void linkYoutube(lesson.id, lesson.title)}
                            >
                              {busy === `youtube-${lesson.id}` ? 'Menyimpan…' : 'Simpan tautan'}
                            </button>
                            <button
                              className="btnGhost btnSmall"
                              type="button"
                              disabled={busy !== null}
                              onClick={() => {
                                setYoutubeLessonId(null);
                                setYoutubeUrl('');
                              }}
                            >
                              Batal
                            </button>
                          </span>
                        </div>
                      ) : null}
                      {bunnyLessonId === lesson.id ? (
                        <div className="videoUploadProgress">
                          <label className="field">
                            <span>GUID video Bunny</span>
                            <input
                              type="text"
                              placeholder="b4dcc06c-ea97-4547-aa95-c17b7c998297"
                              value={bunnySource}
                              disabled={busy !== null}
                              onChange={(event) => setBunnySource(event.currentTarget.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void linkBunny(lesson.id, lesson.title);
                                }
                              }}
                            />
                          </label>
                          <small>
                            Unggah videonya lebih dulu di dashboard Bunny, lalu tempel GUID-nya di
                            sini — tautan yang memuat GUID juga diterima. Bunny mengantar videonya
                            dari CDN, tetapi pemutarnya tetap milik akademi, sehingga watermark dan
                            larangan unduh tetap berlaku.
                          </small>
                          <span className="inlineActions">
                            <button
                              className="btnSecondary btnSmall"
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void linkBunny(lesson.id, lesson.title)}
                            >
                              {busy === `bunny-${lesson.id}` ? 'Menyimpan…' : 'Simpan video Bunny'}
                            </button>
                            <button
                              className="btnGhost btnSmall"
                              type="button"
                              disabled={busy !== null}
                              onClick={() => {
                                setBunnyLessonId(null);
                                setBunnySource('');
                              }}
                            >
                              Batal
                            </button>
                          </span>
                        </div>
                      ) : null}
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
                      {quizLessonId === lesson.id ? (
                        <QuizEditor
                          lessonId={lesson.id}
                          lessonTitle={lesson.title}
                          onClose={() => {
                            setQuizLessonId(null);
                            router.refresh();
                          }}
                        />
                      ) : null}
                      {editingLessonId === lesson.id ? (
                        <Modal
                          title="Ubah materi"
                          description={lesson.title}
                          busy={busy !== null}
                          onClose={() => setEditingLessonId(null)}
                        >
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
                        </Modal>
                      ) : null}
                    </div>
                  ))
                )}

                <div className="addTrigger">
                  <button
                    type="button"
                    className="btn btnGhost"
                    disabled={busy !== null}
                    onClick={() => setAddLessonModuleId(courseModule.id)}
                  >
                    <Plus size={16} /> Tambah materi
                  </button>
                </div>
                {addLessonModuleId === courseModule.id ? (
                  <Modal
                    title="Tambah materi"
                    description={`Masuk ke bagian "${courseModule.title}". Isi yang utama saja — pengaturan lain sudah bernilai otomatis.`}
                    busy={busy !== null}
                    onClose={() => setAddLessonModuleId(null)}
                  >
                    <AddLessonForm
                      moduleId={courseModule.id}
                      disabled={busy !== null}
                      onCancel={() => setAddLessonModuleId(null)}
                      onAdd={async (body) => {
                        const ok = await addLesson(courseModule.id, body);
                        if (ok) setAddLessonModuleId(null);
                        return ok;
                      }}
                    />
                  </Modal>
                ) : null}
              </div>
            </article>
          ))
        )}

        <div className="addTrigger">
          <button
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => setAddModuleOpen(true)}
          >
            <Plus size={16} /> Tambah bagian
          </button>
        </div>
        {addModuleOpen ? (
          <Modal
            title="Tambah bagian"
            description="Bagian mengelompokkan materi di dalam kursus."
            busy={busy !== null}
            onClose={() => setAddModuleOpen(false)}
          >
            <AddModuleForm
              disabled={busy !== null}
              onCancel={() => setAddModuleOpen(false)}
              onAdd={async (title) => {
                const ok = await addModule(title);
                if (ok) setAddModuleOpen(false);
                return ok;
              }}
            />
          </Modal>
        ) : null}
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


      {pickerLesson ? (
        <VideoLibraryPicker
          lessonTitle={pickerLesson.title}
          busy={busy !== null}
          onClose={() => setPickerLesson(null)}
          onSelect={(videoAssetId) => {
            const target = pickerLesson;
            setPickerLesson(null);
            void run(`pilih-video-${target.id}`, async () => {
              await attachToLesson(target.id, videoAssetId);
              setUpload({
                lessonId: target.id,
                fileName: target.title,
                percent: 100,
                status: 'SUCCESS',
                message: 'Video dari perpustakaan dipasang dan siap diputar.',
              });
            });
          }}
        />
      ) : null}
    </>
  );
}

function ModuleTitleForm({
  courseModule,
  moduleNumber,
  disabled,
  onCancel,
  onSave,
}: {
  courseModule: Module;
  moduleNumber: number;
  disabled: boolean;
  onCancel: () => void;
  onSave: (title: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(courseModule.title);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = title.trim();
    if (normalized.length < 3 || normalized === courseModule.title) return;
    await onSave(normalized);
  }

  return (
    <form className="moduleTitleForm" onSubmit={submit}>
      <span aria-hidden="true">{moduleNumber}.</span>
      <label className="srOnly" htmlFor={`module-title-${courseModule.id}`}>
        Nama bagian
      </label>
      <input
        id={`module-title-${courseModule.id}`}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        minLength={3}
        maxLength={160}
        required
        disabled={disabled}
        autoFocus
      />
      <button
        className="btnTiny"
        type="submit"
        disabled={
          disabled ||
          title.trim().length < 3 ||
          title.trim() === courseModule.title
        }
      >
        {disabled ? 'Menyimpan…' : 'Simpan'}
      </button>
      <button className="btnTiny" type="button" onClick={onCancel} disabled={disabled}>
        Batal
      </button>
    </form>
  );
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
      // Hanya dikirim bila kolomnya memang tampil; server yang menentukan
      // bawaannya, dan mengirim angka pada aturan lain hanya akan
      // meninggalkan konfigurasi yatim.
      ...(form.get('completionVideoPercentage')
        ? { completionVideoPercentage: Number(form.get('completionVideoPercentage')) }
        : {}),
    });
  }

  return (
    <form onSubmit={submit}>
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
        {/* Materi kuis selesai hanya dengan lulus kuisnya, jadi pilihan aturan
            selesai tidak berlaku di sana dan tidak ditampilkan. */}
        {contentType === 'QUIZ' ? (
          <div className="field">
            <span className="fieldHint">
              Aturan selesai untuk kuis sudah tetap: pelajar selesai setelah nilainya mencapai
              ambang lulus.
            </span>
          </div>
        ) : (
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
        )}
        {/* Ambangnya hanya berarti pada aturan persentase. Nilai yang tampil
            adalah yang benar-benar ditegakkan server, termasuk bawaannya —
            kolom kosong akan tampak seperti "tidak ada aturan". */}
        {lesson.completionRule === 'VIDEO_PERCENTAGE' ? (
          <div className="field">
            <label htmlFor={`lesson-completion-target-${lesson.id}`}>Persentase tontonan</label>
            <input
              id={`lesson-completion-target-${lesson.id}`}
              name="completionVideoPercentage"
              type="number"
              min={1}
              max={100}
              defaultValue={lesson.completionVideoPercentage ?? 90}
              disabled={disabled}
            />
          </div>
        ) : null}
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
  onCancel,
}: {
  disabled: boolean;
  onAdd: (title: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3) return;
    const ok = await onAdd(title.trim());
    if (ok) setTitle('');
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="new-module">Judul bagian</label>
        <input
          id="new-module"
          placeholder="Minimal 3 karakter"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="lessonEditActions">
        <button className="btn btnGhost" type="button" onClick={onCancel} disabled={disabled}>
          Batal
        </button>
        <button className="btn" type="submit" disabled={disabled || title.trim().length < 3}>
          {disabled ? 'Menyimpan…' : 'Tambah bagian'}
        </button>
      </div>
    </form>
  );
}

function AddLessonForm({
  moduleId,
  disabled,
  onAdd,
  onCancel,
}: {
  moduleId: string;
  disabled: boolean;
  onAdd: (body: LessonUpdateInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]['value']>('TEXT');
  const [completionRule, setCompletionRule] =
    useState<(typeof COMPLETION_RULES)[number]['value']>('OPENED');
  const [showAdvanced, setShowAdvanced] = useState(false);

  function changeContentType(nextType: (typeof CONTENT_TYPES)[number]['value']) {
    setContentType(nextType);
    // Kuis tidak diselesaikan oleh aturan ini melainkan oleh nilainya, jadi
    // nilai yang tersimpan dibiarkan netral. Menyetelnya ke 'OPENED' akan
    // terbaca "selesai saat dibuka" pada materi yang justru tidak begitu.
    if (nextType === 'QUIZ') {
      setCompletionRule('MANUAL');
      return;
    }
    setCompletionRule(nextType === 'VIDEO' ? 'VIDEO_PERCENTAGE' : 'OPENED');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get('title') ?? '').trim();
    if (title.length < 3) return;

    const ok = await onAdd({
      title,
      description: String(form.get('description') ?? '').trim(),
      contentType,
      textContent: contentType === 'TEXT' ? String(form.get('textContent') ?? '').trim() : '',
      externalUrl:
        contentType === 'EXTERNAL_LINK' || contentType === 'PDF'
          ? String(form.get('externalUrl') ?? '').trim()
          : '',
      estimatedMinutes: Number(form.get('estimatedMinutes') ?? 0),
      isRequired: form.get('isRequired') === 'on',
      isPreview: form.get('isPreview') === 'on',
      isActive: form.get('isActive') === 'on',
      completionRule,
      ...(completionRule === 'VIDEO_PERCENTAGE' && form.get('completionVideoPercentage')
        ? { completionVideoPercentage: Number(form.get('completionVideoPercentage')) }
        : {}),
    });
    if (ok) {
      formElement.reset();
      setContentType('TEXT');
      setCompletionRule('OPENED');
      setShowAdvanced(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="lessonEditGrid">
        <div className="field">
          <label htmlFor={`new-lesson-title-${moduleId}`}>Judul</label>
          <input
            id={`new-lesson-title-${moduleId}`}
            name="title"
            placeholder="Contoh: Apa itu AI?"
            minLength={3}
            maxLength={200}
            required
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor={`new-lesson-type-${moduleId}`}>Jenis materi</label>
          <select
            id={`new-lesson-type-${moduleId}`}
            value={contentType}
            onChange={(event) => changeContentType(event.target.value as typeof contentType)}
            disabled={disabled}
          >
            {CONTENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        {contentType === 'TEXT' ? (
          <div className="field lessonEditFull">
            <label htmlFor={`new-lesson-content-${moduleId}`}>Isi artikel atau materi teks</label>
            <textarea
              className="lessonContentInput"
              id={`new-lesson-content-${moduleId}`}
              name="textContent"
              maxLength={50000}
              placeholder="Tulis materi pembelajaran di sini…"
              required
              disabled={disabled}
            />
            <span className="fieldHint">Maksimal 50.000 karakter.</span>
          </div>
        ) : null}
        {contentType === 'EXTERNAL_LINK' || contentType === 'PDF' ? (
          <div className="field lessonEditFull">
            <label htmlFor={`new-lesson-url-${moduleId}`}>
              {contentType === 'PDF' ? 'URL dokumen PDF' : 'URL tujuan'}
            </label>
            <input
              id={`new-lesson-url-${moduleId}`}
              name="externalUrl"
              type="url"
              placeholder="https://"
              required
              disabled={disabled}
            />
          </div>
        ) : null}
        {contentType === 'VIDEO' ? (
          <div className="lessonCreateNotice lessonEditFull">
            Simpan materi ini terlebih dahulu. Tombol unggah MP4, perpustakaan video, dan YouTube
            langsung muncul di baris materi setelah tersimpan.
          </div>
        ) : null}
        {contentType === 'QUIZ' ? (
          <div className="lessonCreateNotice lessonEditFull">
            Setelah materi disimpan, susun soalnya lewat tombol “Susun soal”. Pelajar hanya dapat
            menyelesaikan materi kuis dengan mencapai ambang lulus, bukan dengan menandainya selesai
            sendiri, jadi kursus belum dapat diterbitkan selama soalnya masih kosong.
          </div>
        ) : null}
      </div>
      <div className="lessonQuickOptions">
        <label className="checkRow">
          <input name="isRequired" type="checkbox" defaultChecked disabled={disabled} />
          Materi wajib diselesaikan
        </label>
      </div>
      <details
        className="lessonAdvanced"
        open={showAdvanced}
        onToggle={(event) => setShowAdvanced(event.currentTarget.open)}
      >
        <summary>Pengaturan tambahan</summary>
        <p className="lessonAdvancedHint">Opsional — default saat ini sudah cocok untuk kebanyakan materi.</p>
        <div className="lessonEditGrid">
          <div className="field lessonEditFull">
            <label htmlFor={`new-lesson-description-${moduleId}`}>Deskripsi singkat</label>
            <textarea
              id={`new-lesson-description-${moduleId}`}
              name="description"
              maxLength={2000}
              placeholder="Ringkasan singkat yang tampil pada daftar pelajaran."
              disabled={disabled}
            />
          </div>
          <div className="field">
            <label htmlFor={`new-lesson-duration-${moduleId}`}>Estimasi durasi (menit)</label>
            <input
              id={`new-lesson-duration-${moduleId}`}
              name="estimatedMinutes"
              type="number"
              min={0}
              max={10000}
              defaultValue={0}
              disabled={disabled}
            />
          </div>
          <div className="field">
            <label htmlFor={`new-lesson-completion-${moduleId}`}>Aturan selesai</label>
            <select
              id={`new-lesson-completion-${moduleId}`}
              name="completionRule"
              value={completionRule}
              onChange={(event) => setCompletionRule(event.target.value as typeof completionRule)}
              disabled={disabled}
            >
              {COMPLETION_RULES.map((rule) => (
                <option key={rule.value} value={rule.value}>{rule.label}</option>
              ))}
            </select>
          </div>
          {completionRule === 'VIDEO_PERCENTAGE' ? (
            <div className="field">
              <label htmlFor={`new-lesson-target-${moduleId}`}>Persentase tontonan</label>
              <input
                id={`new-lesson-target-${moduleId}`}
                name="completionVideoPercentage"
                type="number"
                min={1}
                max={100}
                defaultValue={90}
                disabled={disabled}
              />
            </div>
          ) : null}
        </div>
        <div className="lessonOptions">
          <label className="checkRow">
            <input name="isPreview" type="checkbox" disabled={disabled} />
            Bisa dipreview sebelum mendapat akses
          </label>
          <label className="checkRow">
            <input name="isActive" type="checkbox" defaultChecked disabled={disabled} />
            Langsung aktif
          </label>
        </div>
      </details>
      <div className="lessonEditActions">
        <button className="btn btnGhost" type="button" onClick={onCancel} disabled={disabled}>
          Batal
        </button>
        <button className="btn" type="submit" disabled={disabled}>
          {disabled ? 'Menyimpan…' : 'Tambah materi'}
        </button>
      </div>
    </form>
  );
}

function contentLabel(value: string): string {
  return CONTENT_TYPES.find((type) => type.value === value)?.label ?? value;
}
