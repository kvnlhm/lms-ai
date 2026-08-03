'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';

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
        const playback = unwrap(
          await browserClient().POST('/api/v1/learn/lessons/{lessonId}/playback-sessions', {
            params: { path: { lessonId } },
            body: { deviceId: navigator.userAgent.slice(0, 200) },
          }),
        ) as unknown as PlaybackSession;
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
      <div className="protectedVideoFrame" onContextMenu={(event) => event.preventDefault()}>
        <iframe
          src={session.embedUrl}
          title="Video pelajaran"
          allow="accelerometer; autoplay; encrypted-media; gyroscope"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <span className="videoViewerWatermark" aria-hidden="true">{session.watermark.text}</span>
      </div>
    );
  }

  if (!session.playbackUrl) return <p className="stageNote">Menyiapkan video…</p>;


  return (
    <div className="protectedVideoFrame" onContextMenu={(event) => event.preventDefault()}>
      {session.kind === 'HLS' ? (
        <HlsVideo src={session.playbackUrl} onFailure={gagalDiputar} />
      ) : (
        <video
          controls
          controlsList="nodownload noremoteplayback nofullscreen"
          disablePictureInPicture
          disableRemotePlayback
          preload="metadata"
          src={session.playbackUrl}
          onError={gagalDiputar}
        >
          Browser kamu tidak mendukung pemutar video HTML5.
        </video>
      )}
      <span className="videoViewerWatermark" aria-hidden="true">{session.watermark.text}</span>
    </div>
  );
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
function HlsVideo({ src, onFailure }: { src: string; onFailure: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        // Hanya kegagalan fatal yang dilaporkan; hls.js memulihkan sendiri
        // gangguan jaringan sesaat, dan itu justru gunanya memakai HLS.
        if (data.fatal) onFailure();
      });
    });

    return () => {
      dibatalkan = true;
      hls?.destroy();
    };
  }, [src, onFailure]);

  return (
    <video
      ref={videoRef}
      controls
      controlsList="nodownload noremoteplayback nofullscreen"
      disablePictureInPicture
      disableRemotePlayback
      preload="metadata"
    >
      Browser kamu tidak mendukung pemutar video HTML5.
    </video>
  );
}
