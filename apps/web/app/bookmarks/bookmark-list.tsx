'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../components/notifier';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

type Bookmark = Schemas['BookmarkDto'];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

/**
 * Daftar materi bertanda, beserta cara mengelolanya.
 *
 * Catatan pribadi sudah lama didukung API dan bahkan sudah dirender halaman
 * ini — tetapi tidak ada satu pun antarmuka yang dapat mengisinya, jadi
 * barisnya tidak pernah muncul. Melepas tanda pun sebelumnya hanya bisa
 * dilakukan dengan membuka kembali materinya satu per satu, padahal di sinilah
 * tempat orang merapikan simpanannya.
 */
export function BookmarkList({ bookmarks }: { bookmarks: Bookmark[] }) {
  const router = useRouter();
  const notifier = useNotifier();
  const [busy, setBusy] = useState<string | null>(null);

  async function jalankan(lessonId: string, tugas: () => Promise<unknown>, sukses: string) {
    if (busy) return;
    setBusy(lessonId);
    try {
      await tugas();
      notifier.success(sukses);
      router.refresh();
    } catch (caught) {
      void notifier.error('Tindakan gagal dijalankan', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  async function ubahCatatan(bookmark: Bookmark) {
    const catatan = await notifier.prompt(
      bookmark.note ? 'Ubah catatan' : 'Tambah catatan',
      {
        text: `Catatan ini pribadi dan tidak pernah terlihat pengguna lain. Melekat pada “${bookmark.lessonTitle}”.`,
        label: 'Catatanmu',
        placeholder: 'Misalnya: bagian menit 12 perlu ditonton ulang',
        defaultValue: bookmark.note ?? '',
        multiline: true,
        // Nol, bukan satu: mengosongkan isian adalah cara menghapus catatan,
        // bukan kesalahan yang perlu ditolak.
        minLength: 0,
        confirmLabel: 'Simpan catatan',
      },
    );
    // `null` berarti dialognya dibatalkan; string kosong berarti dihapus.
    if (catatan === null) return;

    await jalankan(
      bookmark.lessonId,
      () =>
        browserClient().PUT('/api/v1/learn/lessons/{lessonId}/bookmark', {
          params: { path: { lessonId: bookmark.lessonId } },
          body: { note: catatan },
        }),
      catatan === '' ? 'Catatan dihapus.' : 'Catatan tersimpan.',
    );
  }

  async function lepasTanda(bookmark: Bookmark) {
    const lanjut = await notifier.confirm(`Lepas tanda dari “${bookmark.lessonTitle}”?`, {
      text: bookmark.note
        ? 'Catatan yang melekat padanya ikut terhapus dan tidak dapat dikembalikan.'
        : 'Materinya tetap ada; hanya tandanya yang dilepas.',
      confirmLabel: 'Lepas tanda',
      danger: true,
    });
    if (!lanjut) return;

    await jalankan(
      bookmark.lessonId,
      async () => {
        unwrap(
          await browserClient().DELETE('/api/v1/learn/lessons/{lessonId}/bookmark', {
            params: { path: { lessonId: bookmark.lessonId } },
          }),
        );
      },
      'Tanda dilepas.',
    );
  }

  return (
    <ul className="bookmarkList">
      {bookmarks.map((bookmark) => (
        <li key={bookmark.lessonId} className="card bookmarkItem">
          <div className="bookmarkMain">
            <Link
              className="bookmarkTitle"
              href={`/learn/${bookmark.courseId}/${bookmark.lessonId}`}
            >
              {bookmark.lessonTitle}
            </Link>
            <p className="bookmarkMeta">
              {bookmark.courseTitle} · {bookmark.moduleTitle} · ditandai{' '}
              {formatDate(bookmark.createdAt)}
            </p>
            {bookmark.note ? <p className="bookmarkNote">{bookmark.note}</p> : null}
            <div className="inlineActions bookmarkActions">
              <button
                type="button"
                className="btnTiny"
                disabled={busy !== null}
                onClick={() => void ubahCatatan(bookmark)}
              >
                {bookmark.note ? 'Ubah catatan' : 'Tambah catatan'}
              </button>
              <button
                type="button"
                className="btnGhost btnSmall"
                disabled={busy !== null}
                onClick={() => void lepasTanda(bookmark)}
              >
                {busy === bookmark.lessonId ? 'Memproses…' : 'Lepas tanda'}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
