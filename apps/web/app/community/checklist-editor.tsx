'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { browserClient, ensureSuccess, unwrap } from '../lib/browser-api';
import { uploadChecklistAttachment } from '../lib/checklist-upload';
import type { ChecklistDetailData } from './checklist-detail';

export function ChecklistEditor({ item, detailUrl }: { item: ChecklistDetailData; detailUrl: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(item.title ?? '');
  const [body, setBody] = useState(item.body);
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const save = () => startTransition(async () => {
    setMessage('');
    try {
      const client = browserClient();
      unwrap(await client.PATCH('/api/v1/community/posts/{postId}', { params: { path: { postId: item.id } }, body: { title: title.trim(), body: body.trim() } }));
      if (removeAttachment && item.attachment) ensureSuccess(await client.DELETE('/api/v1/community/checklist/{postId}/attachment', { params: { path: { postId: item.id } } }));
      if (file) await uploadChecklistAttachment(item.id, file, setProgress);
      router.push(detailUrl);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Perubahan belum tersimpan.');
    }
  });

  return <section className="checklistEditorPage">
    <header><Link href={detailUrl}>← Kembali ke checklist</Link><span className="eyebrow">EDITOR CHECKLIST</span><h1>Edit konten checklist</h1><p>Isi akan dibaca pelajar sebelum mereka menandai langkah ini selesai.</p></header>
    <div className="checklistEditorForm">
      <label htmlFor="checklist-edit-title">Judul</label>
      <input id="checklist-edit-title" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />
      <label htmlFor="checklist-edit-body">Konten</label>
      <textarea id="checklist-edit-body" value={body} rows={12} maxLength={5000} onChange={(event) => setBody(event.target.value)} />
      <div className="checklistEditorCount">{body.length}/5000</div>
      <div className="checklistAttachmentEditor">
        <div><strong>Lampiran</strong><span>Satu foto, video, atau PDF. Maksimal 100 MB.</span></div>
        {item.attachment && !removeAttachment && !file ? <div className="checklistAttachmentCurrent"><span>{item.attachment.originalName}</span><button type="button" onClick={() => setRemoveAttachment(true)}>Hapus</button></div> : null}
        {file ? <div className="checklistAttachmentCurrent"><span>{file.name}</span><button type="button" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}>Batal</button></div> : null}
        <label className="btnSecondary checklistAttachmentPick">
          {file || (item.attachment && !removeAttachment) ? 'Ganti berkas' : 'Pilih berkas'}
          <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf" disabled={pending} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveAttachment(false); }} />
        </label>
        {pending && file ? <progress max={100} value={progress}>{progress}%</progress> : null}
      </div>
      {message ? <p className="communityMessage" role="status">{message}</p> : null}
      <div className="checklistEditorActions"><Link className="btnSecondary" href={detailUrl}>Batal</Link><button className="btn" type="button" disabled={pending || !title.trim() || !body.trim()} onClick={save}>{pending ? 'Menyimpan…' : 'Simpan perubahan'}</button></div>
    </div>
  </section>;
}
