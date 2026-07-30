'use client';

import type { Schemas } from '@lms/api-client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';

type Course = Schemas['AdminCourseDetailDto'];

export function CourseSettings({ course }: { course: Course }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      <form onSubmit={submit}>
        <div className="fieldRow">
          <div className="field"><label htmlFor="title">Nama kursus</label><input id="title" name="title" defaultValue={course.title} required minLength={3} /></div>
          <div className="field"><label htmlFor="slug">Slug</label><input id="slug" name="slug" defaultValue={course.slug} required /></div>
        </div>
        <div className="field"><label htmlFor="shortDescription">Deskripsi singkat</label><input id="shortDescription" name="shortDescription" defaultValue={course.shortDescription ?? ''} /></div>
        <div className="field"><label htmlFor="description">Deskripsi lengkap</label><textarea id="description" name="description" defaultValue={course.description ?? ''} /></div>
        <div className="fieldRow">
          <div className="field"><label htmlFor="level">Level</label><select id="level" name="level" defaultValue={course.level}><option value="BEGINNER">Pemula</option><option value="INTERMEDIATE">Menengah</option><option value="ADVANCED">Lanjutan</option></select></div>
          <div className="field"><label htmlFor="estimatedMinutes">Estimasi menit</label><input id="estimatedMinutes" name="estimatedMinutes" type="number" min={0} defaultValue={course.estimatedMinutes} /></div>
        </div>
        {message ? <p className="pageSub" role="status">{message}</p> : null}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
      </form>
    </section>
  );
}
