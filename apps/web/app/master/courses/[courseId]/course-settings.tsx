'use client';

import type { Schemas } from '@lms/api-client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ApiError,
  browserApiUrl,
  browserClient,
  ensureSuccess,
  readCsrfToken,
  unwrap,
} from '../../../lib/browser-api';

type Course = Schemas['AdminCourseDetailDto'];
type Category = Schemas['AdminCategoryDto'];

export function CourseSettings({ course, categories }: { course: Course; categories: Category[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState<number | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnailUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseThumbnail(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Pilih gambar JPEG, PNG, atau WebP.');
      event.target.value = '';
      return;
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      setMessage('Ukuran thumbnail maksimal 5 MB.');
      event.target.value = '';
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl(nextPreview);
    setThumbnailBusy(true);
    setThumbnailProgress(0);
    setMessage(null);

    const request = new XMLHttpRequest();
    request.open('PUT', `${browserApiUrl()}/api/v1/admin/courses/${course.id}/thumbnail`);
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', file.type);
    const csrf = readCsrfToken();
    if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);
    request.upload.onprogress = (progress) => {
      if (progress.lengthComputable) {
        setThumbnailProgress(Math.round((progress.loaded / progress.total) * 100));
      }
    };
    request.onload = () => {
      setThumbnailBusy(false);
      setThumbnailProgress(null);
      event.target.value = '';
      if (request.status >= 200 && request.status < 300) {
        try {
          const payload = JSON.parse(request.responseText) as { data?: { thumbnailUrl?: string } };
          setThumbnailUrl(payload.data?.thumbnailUrl ?? nextPreview);
        } catch {
          setThumbnailUrl(nextPreview);
        }
        setMessage('Thumbnail berhasil diperbarui.');
        router.refresh();
        return;
      }
      setPreviewUrl(null);
      setMessage(apiMessage(request.responseText));
    };
    request.onerror = () => {
      setThumbnailBusy(false);
      setThumbnailProgress(null);
      setPreviewUrl(null);
      event.target.value = '';
      setMessage('Tidak dapat menghubungi server.');
    };
    request.send(file);
  }

  async function removeThumbnail() {
    if (thumbnailBusy || !thumbnailUrl) return;
    setThumbnailBusy(true);
    setMessage(null);
    try {
      ensureSuccess(
        await browserClient().DELETE('/api/v1/admin/courses/{courseId}/thumbnail', {
          params: { path: { courseId: course.id } },
        }),
      );
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setThumbnailUrl(null);
      setMessage('Thumbnail berhasil dihapus.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Thumbnail gagal dihapus.');
    } finally {
      setThumbnailBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      unwrap(await browserClient().PATCH('/api/v1/admin/courses/{courseId}', {
        params: { path: { courseId: course.id } },
        body: {
          title: String(form.get('title') ?? ''),
          slug: String(form.get('slug') ?? ''),
          shortDescription: String(form.get('shortDescription') ?? ''),
          description: String(form.get('description') ?? ''),
          categoryId: String(form.get('categoryId') ?? '') || undefined,
          level: String(form.get('level') ?? 'BEGINNER') as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
          estimatedMinutes: Number(form.get('estimatedMinutes') ?? 0),
        },
      }));
      setMessage('Perubahan tersimpan.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Perubahan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card settingsCard">
      <div className="panelHead"><div><h2>Informasi kursus</h2><p className="pageSub">Atur identitas dan deskripsi kursus.</p></div></div>
      <div className="courseThumbnailEditor">
        <div className="courseThumbnailPreview">
          {previewUrl || thumbnailUrl ? (
            <img src={previewUrl ?? thumbnailUrl ?? ''} alt={`Thumbnail ${course.title}`} />
          ) : (
            <div><strong>Belum ada thumbnail</strong><span>Rasio 16:9 disarankan</span></div>
          )}
        </div>
        <div>
          <h3>Thumbnail kursus</h3>
          <p className="pageSub">JPEG, PNG, atau WebP, maksimal 5 MB. Rekomendasi minimal 800×450 piksel.</p>
          <input
            ref={fileInput}
            className="visuallyHidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseThumbnail}
            disabled={thumbnailBusy}
          />
          <div className="avatarActions">
            <button className="btnTiny" type="button" disabled={thumbnailBusy} onClick={() => fileInput.current?.click()}>
              {thumbnailBusy ? 'Mengunggah…' : thumbnailUrl ? 'Ganti thumbnail' : 'Unggah thumbnail'}
            </button>
            {thumbnailUrl ? (
              <button className="btnTiny avatarRemove" type="button" disabled={thumbnailBusy} onClick={removeThumbnail}>
                Hapus
              </button>
            ) : null}
          </div>
          {thumbnailProgress !== null ? (
            <div className="avatarProgress" role="progressbar" aria-label="Progres upload thumbnail" aria-valuemin={0} aria-valuemax={100} aria-valuenow={thumbnailProgress}>
              <span style={{ width: `${thumbnailProgress}%` }} />
            </div>
          ) : null}
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="fieldRow">
          <div className="field"><label htmlFor="title">Nama kursus</label><input id="title" name="title" defaultValue={course.title} required minLength={3} /></div>
          <div className="field"><label htmlFor="slug">Slug</label><input id="slug" name="slug" defaultValue={course.slug} required /></div>
        </div>
        <div className="field"><label htmlFor="shortDescription">Deskripsi singkat</label><input id="shortDescription" name="shortDescription" defaultValue={course.shortDescription ?? ''} /></div>
        <div className="field"><label htmlFor="description">Deskripsi lengkap</label><textarea id="description" name="description" defaultValue={course.description ?? ''} /></div>
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="categoryId">Kategori</label>
            <select id="categoryId" name="categoryId" defaultValue={course.categoryId ?? ''} required>
              <option value="" disabled>Pilih kategori</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="level">Level</label><select id="level" name="level" defaultValue={course.level}><option value="BEGINNER">Pemula</option><option value="INTERMEDIATE">Menengah</option><option value="ADVANCED">Lanjutan</option></select></div>
        </div>
        <div className="field"><label htmlFor="estimatedMinutes">Estimasi menit</label><input id="estimatedMinutes" name="estimatedMinutes" type="number" min={0} defaultValue={course.estimatedMinutes} /></div>
        {message ? <p className="pageSub" role="status">{message}</p> : null}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
      </form>
    </section>
  );
}

function apiMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; fields?: Record<string, string[]> } };
    return parsed.error?.fields?.file?.[0] ?? parsed.error?.message ?? 'Upload thumbnail gagal.';
  } catch {
    return 'Upload thumbnail gagal.';
  }
}
