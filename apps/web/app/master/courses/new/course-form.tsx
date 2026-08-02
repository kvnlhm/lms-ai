'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../../components/notifier';
import { ApiError, browserApiUrl, browserClient, readCsrfToken, unwrap } from '../../../lib/browser-api';

type Category = Schemas['AdminCategoryDto'];

const LEVELS = [
  { value: 'BEGINNER', label: 'Pemula' },
  { value: 'INTERMEDIATE', label: 'Menengah' },
  { value: 'ADVANCED', label: 'Lanjutan' },
] as const;

const JENIS_GAMBAR = ['image/jpeg', 'image/png', 'image/webp'];
const BATAS_GAMBAR = 5 * 1024 * 1024;

export function CourseForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const notifier = useNotifier();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState<(typeof LEVELS)[number]['value']>('BEGINNER');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  /**
   * Thumbnail ditahan di sini, tidak langsung diunggah.
   *
   * Endpoint unggahnya beralamat `/admin/courses/{courseId}/thumbnail`, jadi
   * kursusnya harus ada lebih dulu. Berkasnya disimpan di klien sampai kursus
   * berhasil dibuat, lalu diunggah menyusul — sehingga dari sisi pengguna
   * semuanya tetap satu formulir.
   */
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  /** Slug diisi otomatis dari judul sampai Master mengubahnya sendiri. */
  function handleTitle(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function pilihThumbnail(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // Batas yang sama ditegakkan server. Diperiksa di sini supaya penolakannya
    // datang sebelum seluruh formulir dikirim, bukan sesudahnya.
    if (!JENIS_GAMBAR.includes(file.type)) {
      void notifier.error('Format gambar tidak didukung', {
        text: 'Pilih gambar JPEG, PNG, atau WebP.',
      });
      event.target.value = '';
      return;
    }
    if (file.size < 1 || file.size > BATAS_GAMBAR) {
      void notifier.error('Ukuran gambar terlalu besar', {
        text: 'Ukuran thumbnail maksimal 5 MB.',
      });
      event.target.value = '';
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setThumbnail(file);
  }

  function hapusThumbnail() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setThumbnail(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  /** Unggah thumbnail ke kursus yang baru dibuat. */
  function unggahThumbnail(courseId: string, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', `${browserApiUrl()}/api/v1/admin/courses/${courseId}/thumbnail`);
      request.withCredentials = true;
      request.setRequestHeader('Content-Type', file.type);
      const csrf = readCsrfToken();
      if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);
      request.onload = () =>
        request.status >= 200 && request.status < 300
          ? resolve()
          : reject(new Error(String(request.status)));
      request.onerror = () => reject(new Error('network'));
      request.send(file);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFields({});

    try {
      const menit = Number.parseInt(estimatedMinutes, 10);
      const created = unwrap(
        await browserClient().POST('/api/v1/admin/courses', {
          body: {
            title,
            slug,
            level,
            ...(shortDescription ? { shortDescription } : {}),
            ...(description ? { description } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(Number.isFinite(menit) && menit >= 0 ? { estimatedMinutes: menit } : {}),
          },
        }),
      );

      // Kursusnya sudah ada pada titik ini. Kegagalan mengunggah thumbnail
      // karena itu tidak boleh dilaporkan sebagai kegagalan membuat kursus —
      // pengguna tetap diantar ke kursusnya, dengan pemberitahuan bahwa
      // gambarnya perlu dipasang ulang dari pengaturan.
      if (thumbnail) {
        try {
          await unggahThumbnail(created.id, thumbnail);
        } catch {
          void notifier.error('Kursus dibuat, thumbnail belum terpasang', {
            text: 'Unggah ulang gambarnya dari tab Settings pada kursus ini.',
          });
        }
      }

      router.replace(`/master/courses/${created.id}`);
      router.refresh();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError) {
        // Rinciannya tetap muncul di bawah kolomnya masing-masing; modal
        // hanya merangkum supaya kegagalannya tidak terlewat.
        if (error.fields) setFields(error.fields);
        void notifier.error('Kursus belum dibuat', {
          text: error.message,
          reasons: Object.values(error.fields ?? {}).flat(),
        });
        return;
      }
      void notifier.error('Tidak dapat menghubungi server', {
        text: 'Kursus belum dibuat. Periksa koneksimu lalu coba lagi.',
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="courseThumbnailEditor">
        <div className="courseThumbnailPreview">
          {previewUrl ? (
            <img src={previewUrl} alt="Pratinjau thumbnail" />
          ) : (
            <div>
              <strong>Belum ada thumbnail</strong>
              <span>Rasio 16:9 disarankan</span>
            </div>
          )}
        </div>
        <div>
          <h3>Thumbnail kursus</h3>
          <p className="fieldHint">
            JPEG, PNG, atau WebP, maksimal 5 MB. Diunggah setelah kursusnya dibuat.
          </p>
          <div className="inlineActions">
            <button
              className="btnTiny"
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {thumbnail ? 'Ganti gambar' : 'Pilih gambar'}
            </button>
            {thumbnail ? (
              <button className="btnTiny btnDanger" type="button" disabled={busy} onClick={hapusThumbnail}>
                Hapus
              </button>
            ) : null}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={JENIS_GAMBAR.join(',')}
            className="srOnly"
            onChange={pilihThumbnail}
          />
        </div>
      </div>

      <div className="fieldRow">
        <div className="field">
          <label htmlFor="title">Judul kursus</label>
          <input
            id="title"
            value={title}
            onChange={(event) => handleTitle(event.target.value)}
            required
            minLength={3}
            disabled={busy}
            aria-invalid={fields.title ? true : undefined}
          />
          {fields.title ? <span className="fieldError">{fields.title.join(' ')}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="slug">Slug</label>
          <input
            id="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            required
            disabled={busy}
            aria-describedby="slug-help"
            aria-invalid={fields.slug ? true : undefined}
          />
          <span className="fieldHint" id="slug-help">
            Muncul di URL. Hanya huruf kecil, angka, dan tanda hubung.
          </span>
          {fields.slug ? <span className="fieldError">{fields.slug.join(' ')}</span> : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="shortDescription">Deskripsi singkat</label>
        <input
          id="shortDescription"
          value={shortDescription}
          onChange={(event) => setShortDescription(event.target.value)}
          maxLength={300}
          disabled={busy}
        />
      </div>

      <div className="field">
        <label htmlFor="description">Deskripsi lengkap</label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={5000}
          disabled={busy}
        />
      </div>

      <div className="fieldRow">
        <div className="field">
          <label htmlFor="categoryId">Kategori</label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={busy || categories.length === 0}
          >
            <option value="">Tanpa kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="level">Tingkat</label>
          <select
            id="level"
            value={level}
            onChange={(event) => setLevel(event.target.value as typeof level)}
            disabled={busy}
          >
            {LEVELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="estimatedMinutes">Estimasi menit</label>
          <input
            id="estimatedMinutes"
            type="number"
            min={0}
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(event.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <p className="pageSub" style={{ marginBottom: 18 }}>
        Kursus baru selalu dibuat sebagai draf. Menerbitkannya adalah langkah
        terpisah yang menuntut minimal satu bagian dan satu pelajaran wajib.
      </p>

      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Tambahkan kursus'}
      </button>
    </form>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}
