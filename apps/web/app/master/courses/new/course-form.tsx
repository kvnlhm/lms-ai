'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';

const LEVELS = [
  { value: 'BEGINNER', label: 'Pemula' },
  { value: 'INTERMEDIATE', label: 'Menengah' },
  { value: 'ADVANCED', label: 'Lanjutan' },
] as const;

export function CourseForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [shortDescription, setShortDescription] = useState('');
  const [level, setLevel] = useState<(typeof LEVELS)[number]['value']>('BEGINNER');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  /** Slug diisi otomatis dari judul sampai Master mengubahnya sendiri. */
  function handleTitle(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage(null);
    setFields({});

    try {
      const created = unwrap(
        await browserClient().POST('/api/v1/admin/courses', {
          body: {
            title,
            slug,
            level,
            ...(shortDescription ? { shortDescription } : {}),
          },
        }),
      );
      router.replace(`/master/courses/${created.id}`);
      router.refresh();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError) {
        setMessage(error.message);
        if (error.fields) setFields(error.fields);
        return;
      }
      setMessage('Tidak dapat menghubungi server. Coba lagi.');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {message ? (
        <p className="notice noticeError" role="alert">
          {message}
        </p>
      ) : null}

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
        <span className="fieldError" id="slug-help" style={{ color: 'var(--muted)' }}>
          Muncul di URL. Hanya huruf kecil, angka, dan tanda hubung.
        </span>
        {fields.slug ? <span className="fieldError">{fields.slug.join(' ')}</span> : null}
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
        <label htmlFor="shortDescription">Deskripsi singkat</label>
        <textarea
          id="shortDescription"
          value={shortDescription}
          onChange={(event) => setShortDescription(event.target.value)}
          maxLength={300}
          disabled={busy}
        />
      </div>

      <p className="pageSub" style={{ marginBottom: 18 }}>
        Kursus baru selalu dibuat sebagai draf. Menerbitkannya adalah langkah
        terpisah yang menuntut minimal satu bagian dan satu pelajaran wajib.
      </p>

      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Buat kursus'}
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
