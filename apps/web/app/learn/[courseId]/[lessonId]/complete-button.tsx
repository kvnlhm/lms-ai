'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';
import { ArrowRight, Check } from '../../../components/icons';

interface Props {
  courseId: string;
  lessonId: string;
  nextLessonId: string | null;
  alreadyCompleted: boolean;
  openedAt: number;
}

export function CompleteButton({
  courseId,
  lessonId,
  nextLessonId,
  alreadyCompleted,
  openedAt,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Kunci idempotensi dibuat sekali per pemasangan komponen.
   *
   * Bila jaringan putus dan pengguna menekan tombol lagi, permintaan kedua
   * membawa kunci yang sama sehingga server mengembalikan hasil percobaan
   * pertama alih-alih menghitung ulang progres.
   */
  const idempotencyKey = useRef(crypto.randomUUID());

  async function handleComplete() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const result = unwrap(
        await browserClient().POST('/api/v1/learn/lessons/{lessonId}/complete', {
          params: {
            path: { lessonId },
            header: { 'idempotency-key': idempotencyKey.current },
          },
          body: {
            completionEvidence: {
              activeSeconds: Math.max(0, Math.round((Date.now() - openedAt) / 1000)),
            },
          },
        }),
      );

      if (result.nextLessonId) {
        router.push(`/learn/${courseId}/${result.nextLessonId}`);
      } else {
        router.push(`/courses/${courseId}`);
      }
      router.refresh();
    } catch (caught) {
      setBusy(false);
      if (caught instanceof ApiError) {
        if (caught.isUnauthenticated) {
          router.replace(`/login?next=/learn/${courseId}/${lessonId}`);
          return;
        }
        setError(caught.message);
        return;
      }
      setError('Tidak dapat menghubungi server. Progres belum tersimpan; coba lagi.');
    }
  }

  if (alreadyCompleted) {
    return (
      <>
        <span className="pill pillGood">
          <Check size={13} strokeWidth={3} /> Pelajaran selesai
        </span>
        {nextLessonId ? (
          <button
            type="button"
            className="btn"
            onClick={() => router.push(`/learn/${courseId}/${nextLessonId}`)}
          >
            Pelajaran berikutnya <ArrowRight size={16} />
          </button>
        ) : null}
      </>
    );
  }

  return (
    <>
      {error ? (
        <p className="notice noticeError" role="alert" style={{ marginBottom: 4 }}>
          {error}
        </p>
      ) : null}
      <button type="button" className="btn" onClick={handleComplete} disabled={busy}>
        {busy ? 'Menyimpan…' : 'Tandai selesai'}
        {busy ? null : <ArrowRight size={16} />}
      </button>
    </>
  );
}
