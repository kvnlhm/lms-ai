'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/modal';
import { BarChart, FileText, ImageIcon, Plus, Trash, Video } from '../components/icons';
import { uploadDraftAttachment, uploadDraftVideo, type LampiranTerunggah } from '../lib/checklist-upload';
import { browserClient, ensureSuccess, unwrap } from '../lib/browser-api';
import { ukuranTerbaca } from './post-attachments';

/** Sejalan dengan COMMUNITY_ATTACHMENT_MAX_PER_POST di API. */
const MAKS_LAMPIRAN = 10;
/** Sejalan dengan COMMUNITY_ATTACHMENT_MAX_DRAFT_UPLOAD_BYTES di API. */
const MAKS_BYTE = 10_485_760;
/** Sejalan dengan POLLING_MIN dan POLLING_MAKS di API. */
const POLLING_MIN = 2;
const POLLING_MAKS = 6;

const TERIMA = {
  gambar: 'image/jpeg,image/png,image/webp',
  video: 'video/mp4,video/webm',
  dokumen: 'application/pdf',
} as const;

/**
 * Composer postingan.
 *
 * Berkasnya diunggah begitu dipilih, bukan saat Terbitkan ditekan. Penulisnya
 * jadi tahu lebih awal kalau berkasnya ditolak — dan pratinjaunya baru bisa
 * ditampilkan setelah server menerimanya. Yang diunggah lalu ditinggalkan akan
 * disapu server; menutup composer tidak meninggalkan sampah permanen.
 */
export function PostComposer({ channelName, announcement, pending, onPublish }: {
  channelName: string;
  announcement: boolean;
  pending: boolean;
  onPublish: (input: { title: string; body: string; attachmentIds: string[]; pollOptions?: string[] }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [lampiran, setLampiran] = useState<LampiranTerunggah[]>([]);
  const [progres, setProgres] = useState<number | null>(null);
  const [galat, setGalat] = useState('');
  const berkasRef = useRef<HTMLInputElement>(null);
  const [terima, setTerima] = useState<string>(TERIMA.gambar);
  /** `null` berarti postingan biasa; larik berarti composer sedang menyusun polling. */
  const [polling, setPolling] = useState<string[] | null>(null);
  const [draftsLoaded, setDraftsLoaded] = useState(false);

  const sibuk = pending || progres !== null;
  const penuh = lampiran.length >= MAKS_LAMPIRAN;

  useEffect(() => {
    if (!open || draftsLoaded) return;
    void (async () => {
      try {
        const drafts = unwrap(await browserClient().GET('/api/v1/community/attachments/drafts', {}));
        setLampiran(drafts);
      } catch {
        // Gagal memulihkan draf tidak menghalangi pembuatan postingan baru.
      } finally {
        setDraftsLoaded(true);
      }
    })();
  }, [open, draftsLoaded]);

  function pilih(jenis: keyof typeof TERIMA) {
    setTerima(TERIMA[jenis]);
    // Nilai input dikosongkan supaya memilih berkas yang sama dua kali tetap
    // memicu `change`; tanpa ini, mencoba ulang setelah gagal tidak berbuat apa apa.
    if (berkasRef.current) { berkasRef.current.value = ''; berkasRef.current.accept = TERIMA[jenis]; berkasRef.current.click(); }
  }

  async function unggah(files: File[]) {
    setGalat('');
    for (const file of files.slice(0, MAKS_LAMPIRAN - lampiran.length)) {
      if (file.size > MAKS_BYTE) { setGalat(`Ukuran maksimal ${ukuranTerbaca(MAKS_BYTE)} per berkas.`); continue; }
      setProgres(0);
      try {
        // Video menempuh jalur berbeda: bytenya diunggah langsung ke penyedia,
        // tidak melewati server akademi.
        const hasil = file.type.startsWith('video/')
          ? await uploadDraftVideo(file, setProgres)
          : await uploadDraftAttachment(file, setProgres);
        setLampiran((current) => [...current, hasil]);
      } catch (error) {
        setGalat(error instanceof Error ? error.message : 'Lampiran gagal diunggah.');
      } finally {
        setProgres(null);
      }
    }
  }

  async function buang(id: string) {
    setLampiran((current) => current.filter((item) => item.id !== id));
    try {
      ensureSuccess(await browserClient().DELETE('/api/v1/community/attachments/{attachmentId}', { params: { path: { attachmentId: id } } }));
    } catch {
      // Sudah hilang dari daftar, jadi ia tidak akan ikut diterbitkan. Berkas
      // yang tertinggal di server disapu sendiri karena tidak pernah terikat.
    }
  }

  const pollingSiap = polling === null || polling.map((item) => item.trim()).filter(Boolean).length >= POLLING_MIN;

  async function terbitkan() {
    setGalat('');
    const berhasil = await onPublish({
      title: title.trim(), body: body.trim(), attachmentIds: lampiran.map((item) => item.id),
      ...(polling ? { pollOptions: polling.map((item) => item.trim()).filter(Boolean) } : {}),
    });
    if (!berhasil) return;
    setTitle(''); setBody(''); setLampiran([]); setPolling(null); setOpen(false);
  }

  function tutup() {
    if (sibuk) return;
    // Lampiran sengaja tidak dibuang di sini: penulisnya sering menutup untuk
    // membaca ulang feed lalu kembali. Yang benar-benar ditinggalkan disapu
    // server sesudah ambang basi.
    setOpen(false);
  }

  return <>
    <button className="composerTrigger card" type="button" onClick={() => setOpen(true)}>
      <Plus size={18} />
      <span>{announcement ? `Tulis pengumuman untuk ${channelName}` : `Bagikan sesuatu ke ${channelName}`}</span>
    </button>

    {open ? <Modal title={announcement ? 'Buat pengumuman' : 'Buat postingan'} busy={sibuk} onClose={tutup}>
      <div className="postComposerForm">
        <input className="composerTitle" value={title} maxLength={160} placeholder="Judul (opsional)" onChange={(event) => setTitle(event.target.value)} />
        <textarea value={body} maxLength={5000} placeholder="Tulis sesuatu…" onChange={(event) => setBody(event.target.value)} />

        {lampiran.length ? <ul className="composerAttachmentList">
          {lampiran.map((item) => <li key={item.id}>
            {item.mimeType.startsWith('image/')
              ? <img src={`/api/v1/community/attachments/${item.id}`} alt="" />
              : <span className="composerAttachmentIcon">{item.mimeType.startsWith('video/') ? <Video size={18} /> : <FileText size={18} />}</span>}
            <span className="composerAttachmentName">{item.originalName}</span>
            <small>{ukuranTerbaca(item.sizeBytes)}</small>
            <button type="button" aria-label={`Buang ${item.originalName}`} disabled={sibuk} onClick={() => void buang(item.id)}><Trash size={15} /></button>
          </li>)}
        </ul> : null}

        {polling ? <div className="composerPoll">
          <div className="composerPollHead"><strong>Jajak pendapat</strong><button type="button" onClick={() => setPolling(null)}>Buang polling</button></div>
          {polling.map((nilai, index) => <input
            key={index}
            value={nilai}
            maxLength={120}
            placeholder={`Pilihan ${index + 1}`}
            onChange={(event) => setPolling((current) => (current ?? []).map((item, i) => (i === index ? event.target.value : item)))}
          />)}
          {polling.length < POLLING_MAKS ? <button type="button" className="composerPollAdd" onClick={() => setPolling((current) => [...(current ?? []), ''])}>+ Tambah pilihan</button> : null}
        </div> : null}

        {progres !== null ? <p className="composerProgress" role="status">Mengunggah… {progres}%</p> : null}
        {galat ? <p className="composerError" role="alert">{galat}</p> : null}

        <input
          ref={berkasRef}
          className="srOnly"
          type="file"
          multiple
          accept={terima}
          onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void unggah(files); event.currentTarget.value = ''; }}
        />

        <div className="composerToolbar">
          <button type="button" disabled={sibuk || penuh} onClick={() => pilih('gambar')}><ImageIcon size={18} /><span className="srOnly">Tambah gambar</span></button>
          <button type="button" disabled={sibuk || penuh} onClick={() => pilih('video')}><Video size={18} /><span className="srOnly">Tambah video</span></button>
          <button type="button" disabled={sibuk || penuh} onClick={() => pilih('dokumen')}><FileText size={18} /><span className="srOnly">Tambah dokumen PDF</span></button>
          <button type="button" className={polling ? 'aktif' : ''} disabled={sibuk} aria-pressed={Boolean(polling)} onClick={() => setPolling((current) => (current ? null : ['', '']))}><BarChart size={18} /><span className="srOnly">Jajak pendapat</span></button>
          <span className="composerCount">{lampiran.length}/{MAKS_LAMPIRAN} berkas · {body.length}/5000</span>
          <button className="btn" type="button" disabled={sibuk || !body.trim() || !pollingSiap} onClick={() => void terbitkan()}>Terbitkan</button>
        </div>
      </div>
    </Modal> : null}
  </>;
}
