import { ArrowLeft, ArrowRight, FastForward, FileText, Maximize, Minimize, Pause, Play, Rewind, Settings, Volume, VolumeOff, X } from '../components/icons';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';

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

/** Sama dengan pemutar pelajaran, supaya pilihannya tidak berbeda antar tempat. */
const KECEPATAN = [0.5, 0.75, 1, 1.25, 1.5, 2];

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
  const bingkaiRef = useRef<HTMLDivElement | null>(null);
  const src = item.video?.playbackUrl ?? null;
  const [diputar, setDiputar] = useState(false);
  const [posisi, setPosisi] = useState(0);
  const [durasi, setDurasi] = useState(0);
  const [bisu, setBisu] = useState(false);
  const [penuh, setPenuh] = useState(false);
  const [kecepatan, setKecepatan] = useState(1);
  const [panelTerbuka, setPanelTerbuka] = useState(false);
  // URL-nya bertanda tangan dan bermasa berlaku, jadi ia dapat berganti tanpa
  // videonya berganti. Memasang ulang pemutar setiap kali tandatangannya
  // diperbarui akan melempar tontonan kembali ke detik nol; yang menentukan
  // perlu-tidaknya memasang ulang adalah identitas lampirannya, bukan URL-nya.
  const srcRef = useRef(src);
  srcRef.current = src;
  const siap = Boolean(src);

  useEffect(() => {
    const video = videoRef.current;
    const src = srcRef.current;
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
  }, [item.id, siap]);

  useEffect(() => {
    if (!panelTerbuka) return;
    const tutup = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.courseVideoSettings')) setPanelTerbuka(false);
    };
    document.addEventListener('pointerdown', tutup);
    return () => document.removeEventListener('pointerdown', tutup);
  }, [panelTerbuka]);

  useEffect(() => {
    // Keluar layar penuh lewat Escape tidak melewati tombol kita.
    const ikuti = () => setPenuh(document.fullscreenElement === bingkaiRef.current);
    document.addEventListener('fullscreenchange', ikuti);
    return () => document.removeEventListener('fullscreenchange', ikuti);
  }, []);

  if (!src) {
    const gagal = item.video?.status === 'FAILED';
    return (
      <div className="postMediaItem postVideoMenunggu" role="status">
        <span>{gagal ? 'Video gagal diproses.' : 'Video sedang disiapkan…'}</span>
        <small>{gagal ? 'Coba unggah ulang.' : 'Muat ulang halaman sebentar lagi.'}</small>
      </div>
    );
  }

  const lompat = (detik: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration || 0, Math.max(0, video.currentTime + detik));
  };

  const putar = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play(); else video.pause();
  };

  const layarPenuh = () => {
    const bingkai = bingkaiRef.current;
    if (!bingkai) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void bingkai.requestFullscreen();
  };

  /**
   * Pintasan papan tik, mengikuti kebiasaan YouTube dan sama persis dengan
   * pemutar pelajaran — panah 5 detik, J dan L 10 detik, angka melompat ke
   * persentase. Orang membawa refleks itu dari satu tempat ke tempat lain, dan
   * pemutar yang menafsirkannya berbeda terasa rusak meski setiap tombolnya
   * bekerja.
   *
   * Hanya hidup ketika pemutarnya dipegang fokus, bukan dipasang pada dokumen.
   * Umpan komunitas penuh kolom balasan; spasi yang selalu menjeda video akan
   * merebut spasi dari orang yang sedang mengetik.
   */
  const pintasan = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const asal = (event.target as HTMLElement).tagName;
    if (asal === 'INPUT' || asal === 'SELECT' || asal === 'TEXTAREA') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const GULIR = [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (GULIR.includes(event.key)) event.preventDefault();

    const video = videoRef.current;
    if (!video) return;

    if (/^[0-9]$/.test(event.key)) {
      video.currentTime = ((video.duration || 0) * Number(event.key)) / 10;
      return;
    }

    switch (event.key.toLowerCase()) {
      case ' ':
      case 'k': putar(); break;
      case 'arrowleft': lompat(-5); break;
      case 'arrowright': lompat(5); break;
      case 'j': lompat(-10); break;
      case 'l': lompat(10); break;
      case 'm': video.muted = !video.muted; break;
      case 'f': layarPenuh(); break;
      default: break;
    }
  };

  return (
    <div
      ref={bingkaiRef}
      className={`postMediaItem courseVideoPlayer postVideoPlayer${diputar ? ' isPlaying' : ''}`}
      onDoubleClick={layarPenuh}
      tabIndex={0}
      onKeyDown={pintasan}
      aria-label={`Pemutar video ${item.originalName}`}
    >
      <video
        ref={videoRef}
        preload="metadata"
        playsInline
        onClick={putar}
        onPlay={() => setDiputar(true)}
        onPause={() => setDiputar(false)}
        onEnded={() => setDiputar(false)}
        onTimeUpdate={(event) => setPosisi(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDurasi(event.currentTarget.duration || 0)}
        onVolumeChange={(event) => setBisu(event.currentTarget.muted)}
      />

      {!diputar ? (
        <button className="courseVideoCenterPlay" type="button" onClick={putar} aria-label={`Putar ${item.originalName}`}>
          <Play size={26} />
        </button>
      ) : null}

      <div className="courseVideoControls">
        <div className="courseVideoSeekWrap">
          <input
            className="courseVideoSeek"
            type="range"
            min="0"
            max={durasi || 0}
            step="0.1"
            value={Math.min(posisi, durasi || 0)}
            onChange={(event) => { if (videoRef.current) videoRef.current.currentTime = Number(event.target.value); }}
            aria-label="Posisi video"
            style={{ '--video-progress': `${durasi ? (posisi / durasi) * 100 : 0}%` } as CSSProperties}
          />
        </div>
        <div className="courseVideoControlRow">
          <button type="button" onClick={putar} aria-label={diputar ? 'Jeda' : 'Putar'}>
            {diputar ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="courseVideoSkip" type="button" onClick={() => lompat(-10)} title="Mundur 10 detik (j)" aria-label="Mundur 10 detik">
            <Rewind size={18} /><span aria-hidden="true">10</span>
          </button>
          <button className="courseVideoSkip" type="button" onClick={() => lompat(10)} title="Maju 10 detik (l)" aria-label="Maju 10 detik">
            <FastForward size={18} /><span aria-hidden="true">10</span>
          </button>
          <span className="courseVideoTime">{waktu(posisi)} / {waktu(durasi)}</span>
          <button
            type="button"
            onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}
            aria-label={bisu ? 'Aktifkan suara' : 'Bisukan'}
          >
            {bisu ? <VolumeOff size={18} /> : <Volume size={18} />}
          </button>
          <div className="courseVideoSettings">
            <button type="button" aria-label="Pengaturan video" aria-expanded={panelTerbuka} onClick={() => setPanelTerbuka((nilai) => !nilai)}>
              <Settings size={18} />
            </button>
            {panelTerbuka ? (
              <div className="courseVideoSettingsPanel">
                <label>
                  <span>Kecepatan</span>
                  <select
                    value={kecepatan}
                    onChange={(event) => {
                      const nilai = Number(event.target.value);
                      setKecepatan(nilai);
                      if (videoRef.current) videoRef.current.playbackRate = nilai;
                    }}
                  >
                    {KECEPATAN.map((nilai) => (
                      <option key={nilai} value={nilai}>{nilai === 1 ? 'Normal' : `${nilai}×`}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={layarPenuh} aria-label={penuh ? 'Keluar layar penuh' : 'Layar penuh'}>
            {penuh ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** `m:ss`, cukup untuk klip komunitas yang jarang melewati satu jam. */
function waktu(detik: number): string {
  if (!Number.isFinite(detik) || detik < 0) return '0:00';
  const menit = Math.floor(detik / 60);
  return `${menit}:${String(Math.floor(detik % 60)).padStart(2, '0')}`;
}
