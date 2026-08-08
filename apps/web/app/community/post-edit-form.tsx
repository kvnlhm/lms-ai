'use client';

import { useRef, useState } from 'react';
import { FileText, ImageIcon, Trash, Video } from '../components/icons';
import { Modal } from '../components/modal';
import { uploadDraftAttachment, uploadDraftVideo, type LampiranTerunggah } from '../lib/checklist-upload';
import { browserClient, ensureSuccess } from '../lib/browser-api';
import { ukuranTerbaca, type LampiranPost } from './post-attachments';

/** Sama persis dengan composer; keduanya menyunting isi yang sama. */
const TERIMA = {
  gambar: 'image/jpeg,image/png,image/webp',
  video: 'video/mp4,video/webm',
  dokumen: 'application/pdf',
} as const;
const MAKS_LAMPIRAN = 10;
const MAKS_BYTE = 10_485_760;

export function PostEditForm({ title: initialTitle, body: initialBody, attachments, onSave, onClose }: {
  title: string; body: string; attachments: LampiranPost[];
  onSave: (input: { title: string; body: string; attachmentIds: string[] }) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [lampiran, setLampiran] = useState<LampiranTerunggah[]>(attachments.map((item) => ({ ...item, createdAt: '' })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  function pilih(jenis: keyof typeof TERIMA) {
    // Nilai input dikosongkan supaya memilih berkas yang sama dua kali tetap
    // memicu `change`; tanpa ini, mencoba ulang setelah gagal tidak berbuat apa apa.
    if (input.current) { input.current.value = ''; input.current.accept = TERIMA[jenis]; input.current.click(); }
  }

  async function upload(files: File[]) {
    setError(''); setBusy(true);
    for (const file of files.slice(0, MAKS_LAMPIRAN - lampiran.length)) {
      if (file.size > MAKS_BYTE) { setError(`Ukuran maksimal ${ukuranTerbaca(MAKS_BYTE)} per berkas.`); continue; }
      try {
        // Jalur yang sama dengan composer. Tanpa cabang ini, video yang
        // ditambahkan lewat sunting akan tersimpan sebagai berkas lokal dan
        // melewati penyedia sepenuhnya — dua jalur unggah yang menyimpang.
        const hasil = file.type.startsWith('video/')
          ? await uploadDraftVideo(file, () => {})
          : await uploadDraftAttachment(file, () => {});
        setLampiran((items) => [...items, hasil]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lampiran gagal diunggah.');
      }
    }
    setBusy(false);
  }
  async function remove(id: string) {
    setLampiran((items) => items.filter((item) => item.id !== id));
    if (attachments.some((item) => item.id === id)) return;
    try { ensureSuccess(await browserClient().DELETE('/api/v1/community/attachments/{attachmentId}', { params: { path: { attachmentId: id } } })); } catch { /* stale sweeper */ }
  }
  async function save() {
    if (!body.trim() || busy) return;
    setBusy(true); setError('');
    try { if (await onSave({ title: title.trim(), body: body.trim(), attachmentIds: lampiran.map((item) => item.id) })) onClose(); }
    finally { setBusy(false); }
  }
  return <Modal title="Sunting postingan" busy={busy} onClose={onClose}>
    <div className="postComposerForm">
      <input className="composerTitle" value={title} maxLength={160} placeholder="Judul (opsional)" onChange={(event) => setTitle(event.target.value)} />
      <textarea value={body} maxLength={5000} placeholder="Tulis sesuatu…" onChange={(event) => setBody(event.target.value)} />
      {lampiran.length ? <ul className="composerAttachmentList">{lampiran.map((item) => <li key={item.id}>
        {item.mimeType.startsWith('image/') ? <img src={`/api/v1/community/attachments/${item.id}`} alt="" /> : <span className="composerAttachmentIcon">{item.mimeType.startsWith('video/') ? <Video size={18} /> : <FileText size={18} />}</span>}
        <span className="composerAttachmentName">{item.originalName}</span><small>{ukuranTerbaca(item.sizeBytes)}</small><button type="button" aria-label={`Buang ${item.originalName}`} onClick={() => void remove(item.id)}><Trash size={15} /></button>
      </li>)}</ul> : null}
      {error ? <p className="composerError" role="alert">{error}</p> : null}
      <input ref={input} className="srOnly" type="file" multiple accept={TERIMA.gambar} onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void upload(files); event.currentTarget.value = ''; }} />
      <div className="composerToolbar">
        {/* Tiga tombol yang sama dengan composer. Jajak pendapat sengaja tidak
            ada: menyunting postingan tidak mengubah jajak pendapatnya, dan
            tombol yang tidak berbuat apa-apa lebih buruk daripada tidak ada. */}
        <button type="button" disabled={busy || lampiran.length >= MAKS_LAMPIRAN} onClick={() => pilih('gambar')}><ImageIcon size={18} /><span className="srOnly">Tambah gambar</span></button>
        <button type="button" disabled={busy || lampiran.length >= MAKS_LAMPIRAN} onClick={() => pilih('video')}><Video size={18} /><span className="srOnly">Tambah video</span></button>
        <button type="button" disabled={busy || lampiran.length >= MAKS_LAMPIRAN} onClick={() => pilih('dokumen')}><FileText size={18} /><span className="srOnly">Tambah dokumen PDF</span></button>
        <span className="composerCount">{lampiran.length}/{MAKS_LAMPIRAN} berkas · {body.length}/5000</span>
        <button className="btn" type="button" disabled={busy || !body.trim()} onClick={() => void save()}>Simpan perubahan</button>
      </div>
    </div>
  </Modal>;
}
