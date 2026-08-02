'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useNotifier } from '../../../components/notifier';
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
  const notifier = useNotifier();
  const [busy, setBusy] = useState(false);

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
        void notifier.error('Pelajaran belum ditandai selesai', { text: caught.message });
        return;
      }
      void notifier.error('Tidak dapat menghubungi server', {
        text: 'Progres belum tersimpan. Periksa koneksimu lalu coba lagi.',
      });
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
      <button type="button" className="btn" onClick={handleComplete} disabled={busy}>
        {busy ? 'Menyimpan…' : 'Tandai selesai'}
        {busy ? null : <ArrowRight size={16} />}
      </button>
    </>
  );
}
