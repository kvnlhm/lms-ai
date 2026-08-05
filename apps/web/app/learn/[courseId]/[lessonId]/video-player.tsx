'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type { Schemas } from '@lms/api-client';
import { FastForward, Maximize, Pause, Play, Rewind, Settings, Volume, VolumeOff } from '../../../components/icons';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';
import { catatKemajuan } from './watch-progress';

/**
 * Bentuknya kini datang dari kontrak, bukan disalin dengan tangan. Selama
 * endpoint playback tidak mendokumentasikan responsnya, `kind: 'HLS'` yang
 * lahir bersama Bunny tidak pernah sampai ke sini.
 */
type PlaybackSession = Schemas['PlaybackSessionDto'];

export function VideoPlayer({ lessonId }: { lessonId: string }) {
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Dibungkus useCallback: tanpa itu identitasnya berubah tiap render dan
  // efek di dalam `HlsVideo` akan membongkar-pasang pemutarnya terus-menerus.
  const gagalDiputar = useCallback(() => {
    setSession(null);
    setError(
      'Video tersedia di kursus, tetapi file tidak dapat diputar. Minta Master mengunggah ulang video MP4.',
    );
  }, []);

  useEffect(() => {
    let active = true;
    setSession(null);
    setError(null);
    void (async () => {
      try {
        const playback = unwrap<PlaybackSession>(
await browserClient().POST('/api/v1/learn/lessons/{lessonId}/playback-sessions', {
            params: { path: { lessonId } },
            body: { deviceId: navigator.userAgent.slice(0, 200) },
          }),
  );
        if (active) setSession(playback);
      } catch (caught) {
        if (active) {
          setError(caught instanceof ApiError ? caught.message : 'Video tidak dapat dimuat.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt, lessonId]);

  if (error) {
    return (
      <div className="notice noticeError" role="alert">
        <p>{error}</p>
        <button className="btnSecondary btnSmall" type="button" onClick={() => setAttempt((value) => value + 1)}>
          Coba lagi
        </button>
      </div>
    );
  }
  if (!session) return <p className="stageNote">Menyiapkan video…</p>;

  if (session.kind === 'EMBED') {
    if (!session.embedUrl) {
      return (
        <div className="notice noticeError" role="alert">
          <p>Tautan video tidak valid. Minta Master memperbarui tautannya.</p>
        </div>
      );
    }
    return (
      <div className="protectedVideoFrame embeddedVideoFrame" onContextMenu={(event) => event.preventDefault()}>
        <iframe
          src={session.embedUrl}
          title="Video pelajaran"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  if (!session.playbackUrl) return <p className="stageNote">Menyiapkan video…</p>;

  return (
    <div className="protectedVideoFrame" onContextMenu={(event) => event.preventDefault()}>
      <CourseVideo src={session.playbackUrl} hls={session.kind === 'HLS'} lessonId={lessonId} onFailure={gagalDiputar} />
    </div>
  );
}

/**
 * Posisi terakhir tiap elemen video, untuk membedakan menonton dari menyeret.
 *
 * Disimpan pada elemennya lewat WeakMap, bukan state React: `timeupdate`
 * menyala beberapa kali per detik, dan mengubah state secepat itu akan
 * merender ulang pemutarnya terus-menerus.
 */
const posisiTerakhir = new WeakMap<HTMLVideoElement, number>();

function lacak(lessonId: string, video: HTMLVideoElement): void {
  const sebelumnya = posisiTerakhir.get(video) ?? 0;
  catatKemajuan(lessonId, video.currentTime, video.duration, sebelumnya);
  posisiTerakhir.set(video, video.currentTime);
}

/**
 * Pemutar HLS untuk video yang diantar CDN penyedia.
 *
 * Tetap memakai tag `<video>` milik kita, bukan iframe penyedia, supaya
 * watermark dan larangan unduh tidak berpindah tangan — dan supaya kelak
 * progres tontonan dapat dilacak dari `timeupdate` di sini.
 *
 * Safari dan iOS memutar HLS secara bawaan; di sana `hls.js` sengaja tidak
 * dipakai karena pemutar bawaannya lebih hemat baterai dan mendukung
 * pemutaran layar penuh milik sistem.
 */
function CourseVideo({ src, hls: useHls, lessonId, onFailure }: { src: string; hls: boolean; lessonId: string; onFailure: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qualities, setQualities] = useState<Array<{ index: number; height: number }>>([]);
  const [quality, setQuality] = useState(-1);
  const [seekPreview, setSeekPreview] = useState<{ left: number; time: number } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!useHls) {
      video.src = src;
      return;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    let hls: import('hls.js').default | null = null;
    let dibatalkan = false;
    void import('hls.js').then(({ default: Hls }) => {
      if (dibatalkan || !videoRef.current) return;
      if (!Hls.isSupported()) {
        onFailure();
        return;
      }
      hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const seen = new Set<number>();
        setQualities(hls!.levels.flatMap((level, index) => {
          if (!level.height || seen.has(level.height)) return [];
          seen.add(level.height);
          return [{ index, height: level.height }];
        }).sort((a, b) => b.height - a.height));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        // Hanya kegagalan fatal yang dilaporkan; hls.js memulihkan sendiri
        // gangguan jaringan sesaat, dan itu justru gunanya memakai HLS.
        if (data.fatal) onFailure();
      });
    });

    return () => {
      dibatalkan = true;
      hlsRef.current = null;
      hls?.destroy();
    };
  }, [src, useHls, onFailure]);

  useEffect(() => {
    const hentikanSaatTersembunyi = () => {
      if (document.visibilityState === 'hidden') videoRef.current?.pause();
    };
    document.addEventListener('visibilitychange', hentikanSaatTersembunyi);
    return () => document.removeEventListener('visibilitychange', hentikanSaatTersembunyi);
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play(); else video.pause();
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(value)) return;
    video.currentTime = value;
    setCurrentTime(value);
  }

  function changeVolume(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function changeSpeed(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = value;
    setSpeed(value);
  }

  function changeQuality(level: number) {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = level;
    setQuality(level);
  }

  function skip(seconds: number) {
    seek(Math.min(duration, Math.max(0, currentTime + seconds)));
  }

  function previewSeek(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setSeekPreview({ left: ratio * 100, time: ratio * duration });
  }

  function fullscreen() {
    if (frameRef.current?.requestFullscreen) void frameRef.current.requestFullscreen();
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === ' ' || event.key === 'k') { event.preventDefault(); togglePlay(); }
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'j') skip(-10);
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'l') skip(10);
    if (event.key.toLowerCase() === 'm') toggleMute();
    if (event.key.toLowerCase() === 'f') fullscreen();
    if (event.key === 'Escape') setSettingsOpen(false);
  }

  return (
    <div ref={frameRef} className={`courseVideoPlayer${playing ? ' isPlaying' : ''}`} tabIndex={0} onKeyDown={keyboard} aria-label="Pemutar video pelajaran">
      <video ref={videoRef} controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" onClick={togglePlay} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onError={onFailure} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); lacak(lessonId, event.currentTarget); }}>
        Browser kamu tidak mendukung pemutar video HTML5.
      </video>
      {!playing ? <button className="courseVideoCenterPlay" type="button" onClick={togglePlay} aria-label="Putar video"><Play size={30} /></button> : null}
      <div className="courseVideoControls">
        <div className="courseVideoSeekWrap" onPointerMove={previewSeek} onPointerLeave={() => setSeekPreview(null)}>
          {seekPreview ? <span className="courseVideoSeekPreview" style={{ left: `${seekPreview.left}%` }}>{formatTime(seekPreview.time)}</span> : null}
          <input className="courseVideoSeek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label="Posisi video" style={{ '--video-progress': `${duration ? currentTime / duration * 100 : 0}%` } as CSSProperties} />
        </div>
        <div className="courseVideoControlRow">
          <button type="button" onClick={togglePlay} aria-label={playing ? 'Jeda video' : 'Putar video'}>{playing ? <Pause size={20} /> : <Play size={20} />}</button>
          <button className="courseVideoSkip" type="button" onClick={() => skip(-10)} aria-label="Mundur 10 detik"><Rewind size={20} /><span aria-hidden="true">10</span></button>
          <button className="courseVideoSkip" type="button" onClick={() => skip(10)} aria-label="Maju 10 detik"><FastForward size={20} /><span aria-hidden="true">10</span></button>
          <span className="courseVideoTime">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <div className="courseVideoVolume"><button type="button" onClick={toggleMute} aria-label={muted ? 'Aktifkan suara' : 'Bisukan'}>{muted ? <VolumeOff size={18} /> : <Volume size={18} />}</button><label><span className="srOnly">Volume</span><input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} /></label></div>
          <span className="courseVideoProtected">Konten terlindungi</span>
          <div className="courseVideoSettings">
            <button type="button" aria-label="Pengaturan video" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((value) => !value)}><Settings size={20} /></button>
            {settingsOpen ? <div className="courseVideoSettingsPanel"><label><span>Kecepatan</span><select value={speed} onChange={(event) => changeSpeed(Number(event.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value === 1 ? 'Normal' : `${value}×`}</option>)}</select></label>{qualities.length ? <label><span>Kualitas</span><select value={quality} onChange={(event) => changeQuality(Number(event.target.value))}><option value={-1}>Otomatis</option>{qualities.map((item) => <option key={item.index} value={item.index}>{item.height}p</option>)}</select></label> : <p>Kualitas menyesuaikan koneksi secara otomatis.</p>}</div> : null}
          </div>
          <button type="button" onClick={fullscreen} aria-label="Layar penuh"><Maximize size={20} /></button>
        </div>
      </div>
    </div>
  );
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${Math.floor(value / 60)}:${seconds}`;
}
