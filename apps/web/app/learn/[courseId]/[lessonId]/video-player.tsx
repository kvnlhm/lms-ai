'use client';

import { useEffect, useState } from 'react';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';

/**
 * Respons playback belum dideskripsikan sebagai DTO di OpenAPI, jadi bentuknya
 * ditegaskan di sini seperti pemanggil lain di aplikasi ini.
 */
interface PlaybackSession {
  kind: 'FILE' | 'EMBED';
  playbackUrl: string | null;
  embedUrl: string | null;
}

export function VideoPlayer({ lessonId }: { lessonId: string }) {
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
      <iframe
        src={session.embedUrl}
        title="Video pelajaran"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          maxHeight: '70vh',
          border: 0,
          background: '#000',
          borderRadius: 12,
        }}
      />
    );
  }

  if (!session.playbackUrl) return <p className="stageNote">Menyiapkan video…</p>;

  return (
    <video
      controls
      preload="metadata"
      src={session.playbackUrl}
      onError={() => {
        setSession(null);
        setError(
          'Video tersedia di kursus, tetapi file tidak dapat diputar. Minta Master mengunggah ulang video MP4.',
        );
      }}
      style={{ width: '100%', maxHeight: '70vh', background: '#000', borderRadius: 12 }}
    >
      Browser kamu tidak mendukung pemutar video HTML5.
    </video>
  );
}
