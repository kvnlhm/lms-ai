'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useNotifier } from '../../components/notifier';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';
import {
  fetchLibrary,
  formatBytes,
  type LibraryAsset,
} from '../../components/video-library-picker';
import { titleFromFileName, uploadErrorMessage, uploadToLibrary } from '../../lib/video-upload';

type AntreanStatus = 'MENUNGGU' | 'MENGUNGGAH' | 'MEMVALIDASI' | 'SELESAI' | 'GAGAL';

interface Antrean {
  key: string;
  fileName: string;
  sizeBytes: number;
  percent: number;
  status: AntreanStatus;
  message: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function VideoLibrary() {
  const notifier = useNotifier();
  const [items, setItems] = useState<LibraryAsset[]>([]);
  const [totalBytes, setTotalBytes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [antrean, setAntrean] = useState<Antrean[]>([]);
  const [mengunggah, setMengunggah] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLibrary();
      setItems(data.items);
      setTotalBytes(data.totalBytes);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Perpustakaan gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function perbarui(key: string, patch: Partial<Antrean>) {
    setAntrean((current) =>
      current.map((entri) => (entri.key === key ? { ...entri, ...patch } : entri)),
    );
  }

  /**
   * Mengunggah berkas satu per satu, bukan berbarengan.
   *
   * Video kursus berukuran ratusan megabyte sampai lebih dari satu gigabyte,
   * dan bandwidth unggah rumahan dibagi rata bila dijalankan paralel — total
   * waktunya sama saja, tetapi tidak ada satu pun yang selesai lebih dulu dan
   * kemajuannya jauh lebih sulit dibaca. Berurutan juga menjaga VPS tidak
   * menerima beberapa aliran besar sekaligus.
   */
  async function unggahBanyak(files: File[]) {
    if (mengunggah || files.length === 0) return;

    // Berkas dan entri antreannya dipasangkan sejak awal, bukan dicocokkan
    // lewat indeks belakangan: indeks pada dua larik terpisah adalah cara
    // paling mudah membuat kemajuan tampil pada baris yang salah.
    const pekerjaan = files.map((file, index) => ({
      file,
      entri: {
        key: `${Date.now()}-${index}-${file.name}`,
        fileName: file.name,
        sizeBytes: file.size,
        percent: 0,
        status: 'MENUNGGU' as AntreanStatus,
        message: 'Menunggu giliran',
      },
    }));
    setAntrean(pekerjaan.map(({ entri }) => entri));
    setMengunggah(true);
    setError(null);

    for (const { file, entri } of pekerjaan) {
      const { key } = entri;
      perbarui(key, { status: 'MENGUNGGAH', message: 'Menyiapkan…' });
      try {
        await uploadToLibrary(file, titleFromFileName(file.name), (percent) => {
          perbarui(key, {
            percent,
            status: percent >= 100 ? 'MEMVALIDASI' : 'MENGUNGGAH',
            message: percent >= 100 ? 'Memvalidasi dan menyimpan…' : `Mengunggah ${percent}%`,
          });
        });
        perbarui(key, { percent: 100, status: 'SELESAI', message: 'Masuk perpustakaan' });
      } catch (caught) {
        // Satu berkas gagal tidak menghentikan sisanya: mengulang sepuluh
        // unggahan besar karena satu berkas rusak adalah hukuman yang tidak
        // perlu.
        perbarui(key, { percent: 0, status: 'GAGAL', message: uploadErrorMessage(caught) });
      }
    }

    setMengunggah(false);
    await load();
  }

  async function hapus(item: LibraryAsset) {
    if (busy || mengunggah) return;
    // Berkas hilang dari disk dan tidak dapat dikembalikan dari sini; hanya
    // backup yang bisa. Karena itu penghapusannya dikonfirmasi lebih dulu.
    const lanjut = await notifier.confirm(`Hapus "${item.title}" beserta berkasnya?`, {
      text: 'Berkasnya hilang dari disk dan hanya dapat dikembalikan dari backup.',
      confirmLabel: 'Hapus video',
      danger: true,
    });
    if (!lanjut) return;
    setBusy(item.videoAssetId);
    try {
      unwrap(
        await browserClient().DELETE('/api/v1/admin/videos/{videoAssetId}', {
          params: { path: { videoAssetId: item.videoAssetId } },
        }),
      );
      await load();
    } catch (caught) {
      void notifier.error('Video gagal dihapus', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  const terpakai = items.filter((item) => item.usedBy.length > 0).length;
  const yatim = items.length - terpakai;
  const selesai = antrean.filter((entri) => entri.status === 'SELESAI').length;
  const gagal = antrean.filter((entri) => entri.status === 'GAGAL').length;

  return (
    <section className="stack">
      {error ? <p className="notice noticeError">{error}</p> : null}

      <div className="masterFormPanel">
        <h2 className="sectionTitle">Unggah video</h2>
        <p className="muted">
          Pilih beberapa berkas MP4 sekaligus. Semuanya masuk ke perpustakaan, lalu tinggal dipilih
          saat menyusun pelajaran — tanpa perlu diunggah ulang.
        </p>
        <label className="btn">
          {mengunggah ? 'Sedang mengunggah…' : 'Pilih berkas MP4'}
          <input
            type="file"
            accept="video/mp4,.mp4"
            multiple
            hidden
            disabled={mengunggah}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              void unggahBanyak(files);
            }}
          />
        </label>

        {antrean.length > 0 ? (
          <>
            <p className="muted">
              {selesai} dari {antrean.length} selesai
              {gagal > 0 ? ` · ${gagal} gagal` : ''}
            </p>
            <ul className="masterRecordList">
              {antrean.map((entri) => (
                <li key={entri.key} className="masterRecordCard">
                  <div className="masterListHead">
                    <span className="cellTitle">{entri.fileName}</span>
                    <span className="pill">{formatBytes(String(entri.sizeBytes))}</span>
                  </div>
                  <div className="videoUploadTrack" aria-hidden="true">
                    <div className="videoUploadProgress" style={{ width: `${entri.percent}%` }} />
                  </div>
                  <p className={entri.status === 'GAGAL' ? 'fieldError' : 'cellSub'}>
                    {entri.message}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {loading ? (
        <p className="muted">Memuat perpustakaan…</p>
      ) : (
        <>
          <p className="muted">
            {items.length} video · {formatBytes(totalBytes)} terpakai di disk · {terpakai} dipakai
            pelajaran · {yatim} belum dipakai
          </p>

          {items.length === 0 ? (
            <p className="muted">
              Perpustakaan masih kosong. Unggah beberapa berkas di atas untuk memulai.
            </p>
          ) : (
            <ul className="masterRecordList">
              {items.map((item) => (
                <li key={item.videoAssetId} className="masterRecordCard">
                  <div className="masterListHead">
                    <h2 className="cellTitle">{item.title}</h2>
                    <span className="pill">
                      {item.provider === 'YOUTUBE' ? 'YouTube' : 'Self-hosted'}
                    </span>
                  </div>

                  <p className="cellSub">
                    {item.originalName ?? item.sourceUrl ?? '—'} · {formatBytes(item.sizeBytes)} ·{' '}
                    {item.status} · ditambahkan {formatDate(item.createdAt)}
                  </p>

                  {item.usedBy.length === 0 ? (
                    <p className="muted">Belum dipakai pelajaran mana pun.</p>
                  ) : (
                    <ul className="reasonList">
                      {item.usedBy.map((usage) => (
                        <li key={usage.lessonId}>
                          <Link href={`/master/courses/${usage.courseId}`}>
                            {usage.courseTitle} — {usage.lessonTitle}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="inlineActions">
                    <button
                      type="button"
                      className="btn btnDanger btnSmall"
                      // Dibiarkan dapat ditekan meski masih dipakai: pesan dari
                      // server menyebut berapa pelajaran yang memakainya, yang
                      // lebih berguna daripada tombol mati tanpa penjelasan.
                      disabled={busy === item.videoAssetId || mengunggah}
                      onClick={() => void hapus(item)}
                    >
                      {busy === item.videoAssetId ? 'Menghapus…' : 'Hapus'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
