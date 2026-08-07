import { FileText } from '../components/icons';
import { X } from '../components/icons';
import { useEffect, useState } from 'react';

export type LampiranPost = { id: string; originalName: string; mimeType: string; sizeBytes: string; position: number };

export function ukuranTerbaca(bytes: string | number): string {
  const nilai = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!Number.isFinite(nilai) || nilai <= 0) return '0 KB';
  if (nilai < 1024 * 1024) return `${Math.max(1, Math.round(nilai / 1024))} KB`;
  return `${(nilai / (1024 * 1024)).toFixed(1)} MB`;
}

const alamat = (id: string) => `/api/v1/community/attachments/${id}`;

/**
 * Lampiran di dalam kartu postingan.
 *
 * Media mengikuti bentuk aslinya, bukan sebaliknya. Sebelumnya setiap gambar
 * dipaksa selebar kartu lalu dibatasi tingginya, sehingga gambar potret tampil
 * kecil di tengah dengan bilah kosong lebar di kiri dan kanannya — kartunya
 * memakan tinggi layar untuk menampilkan sebagian besar ruang hampa.
 *
 * Sekarang satu media dibiarkan menentukan ukurannya sendiri: yang melebar
 * dibatasi lebar kartu, yang meninggi dibatasi tinggi maksimum, dan tidak ada
 * yang diregangkan. Dua media atau lebih menjadi deret mendatar setinggi sama —
 * lebarnya berbeda-beda mengikuti rasio masing-masing, dan media berikutnya
 * sengaja mengintip di tepi supaya terlihat bahwa deretnya dapat digeser.
 *
 * Gambar dan video berada dalam satu deret, urut sesuai `position`. Memisahkan
 * keduanya membuat urutan yang dipilih penulisnya hilang begitu ia mencampur
 * jenis.
 *
 * Alamatnya `/api/v1/community/attachments/…` dan bukan jalur berkas — kunci
 * objeknya tidak pernah sampai ke klien.
 */
export function PostAttachments({ attachments }: { attachments: LampiranPost[] }) {
  const [zoom, setZoom] = useState<LampiranPost | null>(null);
  useEffect(() => {
    if (!zoom) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setZoom(null); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [zoom]);
  if (attachments.length === 0) return null;
  const media = attachments
    .filter((item) => item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/'))
    .sort((a, b) => a.position - b.position);
  const berkas = attachments.filter((item) => !item.mimeType.startsWith('image/') && !item.mimeType.startsWith('video/'));

  return <div className="postAttachments">
    {media.length ? <div className={media.length === 1 ? 'postMedia postMediaSingle' : 'postMedia postMediaRow'}>
      {media.map((item) => <MediaItem key={item.id} item={item} onZoom={setZoom} />)}
    </div> : null}
    {berkas.map((item) => <a className="postFileRow" key={item.id} href={alamat(item.id)} target="_blank" rel="noreferrer">
      <FileText size={18} />
      <span>{item.originalName}</span>
      <small>{ukuranTerbaca(item.sizeBytes)}</small>
    </a>)}
    {zoom ? <div className="postLightboxBackdrop" role="dialog" aria-modal="true" aria-label={`Pratinjau ${zoom.originalName}`} onClick={(event) => { if (event.target === event.currentTarget) setZoom(null); }}>
      <button type="button" className="postLightboxClose" aria-label="Tutup gambar" onClick={() => setZoom(null)}><X size={22} /></button>
      <img className="postLightboxImage" src={alamat(zoom.id)} alt={zoom.originalName} />
    </div> : null}
  </div>;
}

function MediaItem({ item, onZoom }: { item: LampiranPost; onZoom: (item: LampiranPost) => void }) {
  if (item.mimeType.startsWith('video/')) {
    // Tidak dibungkus tautan: pembungkusnya akan menelan klik pada tombol putar.
    return <video className="postMediaItem" controls preload="metadata" src={alamat(item.id)} />;
  }
  return <button type="button" className="postMediaItem" onClick={() => onZoom(item)} aria-label={`Perbesar ${item.originalName}`}>
    <img src={alamat(item.id)} alt={item.originalName} loading="lazy" />
  </button>;
}
