'use client';

import { useState } from 'react';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';

/**
 * Tombol tanda materi.
 *
 * Keadaannya diubah lebih dulu di layar, baru dikirim ke server. Menandai
 * materi bukan tindakan yang perlu dikonfirmasi ke pengguna, dan menunggu
 * jaringan untuk perubahan sekecil ini membuat tombolnya terasa rusak. Bila
 * pengirimannya gagal, keadaannya dikembalikan dan alasannya ditampilkan.
 */
export function BookmarkButton({
  lessonId,
  initiallyBookmarked,
}: {
  lessonId: string;
  initiallyBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    setBusy(true);
    setError(null);

    try {
      const client = browserClient();
      const response = next
        ? await client.PUT('/api/v1/learn/lessons/{lessonId}/bookmark', {
            params: { path: { lessonId } },
            body: {},
          })
        : await client.DELETE('/api/v1/learn/lessons/{lessonId}/bookmark', {
            params: { path: { lessonId } },
          });
      const state = unwrap(response) as { bookmarked: boolean };
      setBookmarked(state.bookmarked);
    } catch (caught) {
      setBookmarked(!next);
      setError(caught instanceof ApiError ? caught.message : 'Tanda gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bookmarkControl">
      <button
        type="button"
        className={`btn btnGhost${bookmarked ? ' bookmarkActive' : ''}`}
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={bookmarked}
      >
        {bookmarked ? 'Ditandai' : 'Tandai materi'}
      </button>
      {error ? (
        <span className="fieldError" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
