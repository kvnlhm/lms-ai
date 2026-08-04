'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useNotifier } from '../../../components/notifier';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';
import { ArrowRight, Check } from '../../../components/icons';
import { langgananKemajuan, persenDitonton } from './watch-progress';

interface Props {
  courseId: string;
  lessonId: string;
  nextLessonId: string | null;
  alreadyCompleted: boolean;
  openedAt: number;
  /** Ambang tontonan yang menyelesaikan pelajaran ini, bila aturannya menuntut. */
  videoPercentageTarget: number | null;
}

export function CompleteButton({
  courseId,
  lessonId,
  nextLessonId,
  alreadyCompleted,
  openedAt,
  videoPercentageTarget,
}: Props) {
  const router = useRouter();
  const notifier = useNotifier();
  const [busy, setBusy] = useState(false);
  const [ditonton, setDitonton] = useState(0);

  // Hanya berlangganan bila ada yang perlu ditunggu. Pelajaran tanpa ambang
  // tidak perlu ikut dirender ulang setiap kali video bergerak.
  useEffect(() => {
    if (videoPercentageTarget === null) return;
    setDitonton(persenDitonton(lessonId));
    return langgananKemajuan(lessonId, setDitonton);
  }, [lessonId, videoPercentageTarget]);

  const belumCukup = videoPercentageTarget !== null && ditonton < videoPercentageTarget;

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
              // Diukur pemutar, ditegakkan server. Dikirim selalu, bukan hanya
              // saat ada ambang: buktinya juga tersimpan untuk laporan.
              videoPercentage: persenDitonton(lessonId),
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
      <button type="button" className="btn" onClick={handleComplete} disabled={busy || belumCukup}>
        {busy ? 'Menyimpan…' : 'Tandai selesai'}
        {busy || belumCukup ? null : <ArrowRight size={16} />}
      </button>
      {/* Menyebut targetnya di depan. Tombol yang mati tanpa penjelasan
          membuat orang mengira ada yang rusak, bukan ada yang belum dipenuhi. */}
      {belumCukup ? (
        <span className="completionHint" role="status">
          Tonton {videoPercentageTarget}% untuk menyelesaikan — baru {ditonton}%.
        </span>
      ) : null}
    </>
  );
}
