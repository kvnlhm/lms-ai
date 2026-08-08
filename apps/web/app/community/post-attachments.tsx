import { ArrowLeft, ArrowRight, FileText, X } from '../components/icons';
import { useEffect, useRef, useState } from 'react';

export type LampiranPost = {
  id: string; originalName: string; mimeType: string; sizeBytes: string; position: number;
  width?: number | null; height?: number | null;
  /** Terisi hanya untuk video yang dititipkan ke penyedia luar. */
  video?: { status: string; playbackUrl: string | null } | null;
};

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
  const media = attachments
    .filter((item) => item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/'))
    .sort((a, b) => a.position - b.position);
  const gambar = media.filter((item) => item.mimeType.startsWith('image/'));
  const berkas = attachments.filter((item) => !item.mimeType.startsWith('image/') && !item.mimeType.startsWith('video/'));
  const [zoom, setZoom] = useState<LampiranPost | null>(null);
  const pindah = (arah: -1 | 1) => {
    if (!zoom || gambar.length < 2) return;
    const index = gambar.findIndex((item) => item.id === zoom.id);
    const berikutnya = gambar[(index + arah + gambar.length) % gambar.length];
    if (berikutnya) setZoom(berikutnya);
  };
  useEffect(() => {
    if (!zoom) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoom(null);
      if (event.key === 'ArrowLeft') pindah(-1);
      if (event.key === 'ArrowRight') pindah(1);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [zoom, gambar]);
  if (attachments.length === 0) return null;

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
      {gambar.length > 1 ? <button type="button" className="postLightboxNav postLightboxPrev" aria-label="Foto sebelumnya" onClick={() => pindah(-1)}><ArrowLeft size={28} /></button> : null}
      <button type="button" className="postLightboxClose" aria-label="Tutup gambar" onClick={() => setZoom(null)}><X size={22} /></button>
      <img className="postLightboxImage" src={alamat(zoom.id)} alt={zoom.originalName} />
      {gambar.length > 1 ? <button type="button" className="postLightboxNav postLightboxNext" aria-label="Foto berikutnya" onClick={() => pindah(1)}><ArrowRight size={28} /></button> : null}
    </div> : null}
  </div>;
}

function MediaItem({ item, onZoom }: { item: LampiranPost; onZoom: (item: LampiranPost) => void }) {
  if (item.mimeType.startsWith('video/')) {
    // Video yang dititipkan ke penyedia luar dikenali dari adanya `video`.
    // Yang lama tetap diputar dari berkas kita, tanpa perubahan apa pun.
    if (item.video) return <VideoPenyedia item={item} />;
    // Tidak dibungkus tautan: pembungkusnya akan menelan klik pada tombol putar.
    return <video className="postMediaItem" controls preload="metadata" src={alamat(item.id)} />;
  }
  // `width` dan `height` memberitahu browser rasio gambarnya sebelum bytenya
  // tiba, sehingga ruangnya sudah terpesan dan kartu di bawahnya tidak
  // terdorong saat gambar selesai dimuat. Lampiran yang mendahului kolom ini
  // tidak punya dimensi; perilakunya kembali seperti sebelumnya.
  return <button type="button" className="postMediaItem" onClick={() => onZoom(item)} aria-label={`Perbesar ${item.originalName}`}>
    <img src={alamat(item.id)} alt={item.originalName} loading="lazy" decoding="async" width={item.width ?? undefined} height={item.height ?? undefined} />
  </button>;
}

/**
 * Video yang diantar CDN penyedia.
 *
 * Selama penyedia masih mentranscode, yang ditampilkan keterangan — bukan
 * pemutar yang dibuka pada berkas yang belum ada, yang hanya menghasilkan
 * galat tanpa penjelasan.
 *
 * Safari dan iOS memutar HLS secara bawaan; di sana `hls.js` sengaja tidak
 * dimuat karena pemutar bawaannya lebih hemat baterai dan mendukung layar
 * penuh milik sistem. Aturan yang sama dipakai pemutar pelajaran.
 */
function VideoPenyedia({ item }: { item: LampiranPost }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const src = item.video?.playbackUrl ?? null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    let hls: import('hls.js').default | null = null;
    let dibatalkan = false;
    void import('hls.js').then(({ default: Hls }) => {
      if (dibatalkan || !videoRef.current || !Hls.isSupported()) return;
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
    });

    return () => { dibatalkan = true; hls?.destroy(); };
  }, [src]);

  if (!src) {
    const gagal = item.video?.status === 'FAILED';
    return (
      <div className="postMediaItem postVideoMenunggu" role="status">
        <span>{gagal ? 'Video gagal diproses.' : 'Video sedang disiapkan…'}</span>
        <small>{gagal ? 'Coba unggah ulang.' : 'Muat ulang halaman sebentar lagi.'}</small>
      </div>
    );
  }

  return <video ref={videoRef} className="postMediaItem" controls preload="metadata" playsInline />;
}
