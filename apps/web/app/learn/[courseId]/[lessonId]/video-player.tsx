'use client';

import { useEffect, useState } from 'react';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';

export function VideoPlayer({ lessonId }: { lessonId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setError(null);
    void (async () => {
      try {
        const playback = unwrap(
          await browserClient().POST('/api/v1/learn/lessons/{lessonId}/playback-sessions', {
            params: { path: { lessonId } },
            body: { deviceId: navigator.userAgent.slice(0, 200) },
          }),
        ) as unknown as { playbackUrl: string };
        if (active) setUrl(playback.playbackUrl);
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
  if (!url) return <p className="stageNote">Menyiapkan video…</p>;

  return (
    <video
      controls
      preload="metadata"
      src={url}
      onError={() => {
        setUrl(null);
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
