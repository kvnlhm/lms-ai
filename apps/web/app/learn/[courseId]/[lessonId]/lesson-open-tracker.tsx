'use client';

import { useEffect, useRef } from 'react';
import { browserClient } from '../../../lib/browser-api';

/**
 * Mencatat bahwa sebuah pelajaran dibuka.
 *
 * Endpoint `POST /learn/lessons/{lessonId}/open` sudah ada sejak awal dan
 * mengerjakan empat hal sekaligus: menandai pelajaran `IN_PROGRESS`, menghitung
 * `viewCount`, mengingat pelajaran terakhir pada `course_progress`, dan
 * menerbitkan `learning.lesson_opened`. Tetapi tidak ada satu pun pemanggilnya,
 * sehingga di produksi nol peristiwa itu pernah tercatat.
 *
 * Akibatnya berlapis: histori belajar tidak pernah dapat menampilkan
 * "Pelajaran dibuka", metrik pembukaan pelajaran pada dasbor Master selamanya
 * nol, dan "Lanjutkan belajar" tidak dapat mengingat sampai mana seseorang
 * pernah membaca — ia selalu menawarkan pelajaran pertama yang belum selesai.
 *
 * Tidak menggambar apa pun. Kegagalannya sengaja didiamkan: pencatatan tidak
 * boleh menghalangi orang membaca materinya.
 */
export function LessonOpenTracker({ lessonId }: { lessonId: string }) {
  const sudahDicatat = useRef<string | null>(null);

  useEffect(() => {
    // Penjaga per-lessonId, bukan sekadar boolean: satu komponen ini dipakai
    // ulang saat pelajar berpindah pelajaran tanpa memuat ulang halaman.
    if (sudahDicatat.current === lessonId) return;
    sudahDicatat.current = lessonId;

    void browserClient()
      .POST('/api/v1/learn/lessons/{lessonId}/open', {
        params: { path: { lessonId } },
        body: {},
      })
      .catch(() => {
        // Diam. Pelajar sudah melihat materinya; gagal mencatat bukan
        // kabar yang berguna baginya.
      });
  }, [lessonId]);

  return null;
}
