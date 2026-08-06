'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { browserClient, unwrap } from '../lib/browser-api';
import type { CommunityPost } from './community-feed';

export type ChecklistDetailData = CommunityPost & {
  previousPostId: string | null;
  nextPostId: string | null;
  position: number;
  total: number;
};

export function ChecklistDetail({ item, listUrl }: { item: ChecklistDetailData; listUrl: string }) {
  const router = useRouter();
  const [completed, setCompleted] = useState(item.completedByMe);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const itemUrl = (postId: string) => `${listUrl}/${postId}`;

  const ubahStatus = (checked: boolean) => {
    const sebelumnya = completed;
    setCompleted(checked);
    setMessage('');
    startTransition(async () => {
      try {
        const client = browserClient();
        unwrap(await client.PATCH('/api/v1/community/posts/{postId}/checklist', {
          params: { path: { postId: item.id } }, body: { completed: checked },
        }));
      } catch {
        setCompleted(sebelumnya);
        setMessage('Status belum tersimpan. Silakan coba lagi.');
      }
    });
  };

  const tujuanBerikutnya = item.nextPostId ? itemUrl(item.nextPostId) : listUrl;

  return <article className="checklistArticle">
    <header className="checklistArticleHeader">
      <Link className="checklistArticleBack" href={listUrl}>← Kembali ke daftar checklist</Link>
      <div className="checklistArticleProgress"><span>Langkah {item.position} dari {item.total}</span><span>{item.channel.groupName} / {item.channel.name}</span></div>
      <h1>{item.checklistTitle ?? 'Checklist tanpa judul'}</h1>
      <p>Oleh {item.author.fullName} · {new Date(item.createdAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
    </header>

    <div className="checklistArticleBody">{item.body}</div>

    {item.attachment ? <section className="checklistArticleAttachment" aria-label="Lampiran checklist">
      {item.attachment.mimeType.startsWith('image/') ? <img src={`/api/v1/community/checklist/${item.id}/attachment`} alt={item.attachment.originalName} /> : null}
      {item.attachment.mimeType.startsWith('video/') ? <video controls preload="metadata" src={`/api/v1/community/checklist/${item.id}/attachment`}>Browser tidak mendukung video ini.</video> : null}
      {item.attachment.mimeType === 'application/pdf' ? <iframe src={`/api/v1/community/checklist/${item.id}/attachment`} title={item.attachment.originalName} /> : null}
      <small>{item.attachment.originalName}</small>
    </section> : null}

    <footer className="checklistArticleComplete">
      <label><input type="checkbox" checked={completed} disabled={pending} onChange={(event) => ubahStatus(event.target.checked)} /><span><strong>Saya sudah membaca konten ini</strong><small>Centang setelah selesai membaca untuk melanjutkan.</small></span></label>
      {message ? <p className="communityMessage" role="status">{message}</p> : null}
      <div className="checklistArticleNavigation">
        {item.previousPostId ? <Link className="btnSecondary" href={itemUrl(item.previousPostId)}>Sebelumnya</Link> : <span />}
        <button className="btn" type="button" disabled={!completed || pending} onClick={() => router.push(tujuanBerikutnya)}>{item.nextPostId ? 'Lanjut ke checklist berikutnya' : 'Selesaikan checklist'}</button>
      </div>
    </footer>
  </article>;
}
