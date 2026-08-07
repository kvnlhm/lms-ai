import { FileText } from '../components/icons';

export type LampiranPost = { id: string; originalName: string; mimeType: string; sizeBytes: string; position: number };

export function ukuranTerbaca(bytes: string | number): string {
  const nilai = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!Number.isFinite(nilai) || nilai <= 0) return '0 KB';
  if (nilai < 1024 * 1024) return `${Math.max(1, Math.round(nilai / 1024))} KB`;
  return `${(nilai / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Lampiran di dalam kartu postingan.
 *
 * Gambar disusun sebagai kisi, video diberi pemutar, dan berkas lain menjadi
 * baris unduhan. Kisinya melebar mengikuti jumlah gambar: satu gambar tampil
 * penuh, dua ke atas berbagi baris. Alamatnya `/api/v1/community/attachments/…`
 * dan bukan jalur berkas — kunci objeknya tidak pernah sampai ke klien.
 */
export function PostAttachments({ attachments }: { attachments: LampiranPost[] }) {
  if (attachments.length === 0) return null;
  const gambar = attachments.filter((item) => item.mimeType.startsWith('image/'));
  const video = attachments.filter((item) => item.mimeType.startsWith('video/'));
  const berkas = attachments.filter((item) => !item.mimeType.startsWith('image/') && !item.mimeType.startsWith('video/'));

  return <div className="postAttachments">
    {gambar.length ? <div className={`postImageGrid postImageGrid${Math.min(gambar.length, 3)}`}>
      {gambar.map((item) => <a key={item.id} href={`/api/v1/community/attachments/${item.id}`} target="_blank" rel="noreferrer">
        <img src={`/api/v1/community/attachments/${item.id}`} alt={item.originalName} loading="lazy" />
      </a>)}
    </div> : null}
    {video.map((item) => <video key={item.id} className="postVideo" controls preload="metadata" src={`/api/v1/community/attachments/${item.id}`} />)}
    {berkas.map((item) => <a className="postFileRow" key={item.id} href={`/api/v1/community/attachments/${item.id}`} target="_blank" rel="noreferrer">
      <FileText size={18} />
      <span>{item.originalName}</span>
      <small>{ukuranTerbaca(item.sizeBytes)}</small>
    </a>)}
  </div>;
}
