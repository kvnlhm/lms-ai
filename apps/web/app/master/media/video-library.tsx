'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { Search } from '../../components/icons';
import { ActionMenu } from '../../components/action-menu';
import { useNotifier } from '../../components/notifier';
import { BunnyLibraryBrowser, type BunnyVideo } from '../../components/bunny-library-browser';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';
import {
  ambilPerpustakaan,
  ambilRingkasanPerpustakaan,
  formatBytes,
  namaPenyedia,
  type LibraryAsset,
  type LibraryFilter,
  type LibrarySummary,
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

/** Nilai `null` berarti tanpa penyaring, sama dengan tab "Semua". */
const TAB: Array<[LibraryFilter | null, string]> = [
  [null, 'Semua'],
  ['USED', 'Dipakai'],
  ['ORPHAN', 'Belum dipakai'],
  ['PROBLEM', 'Bermasalah'],
];

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function VideoLibrary() {
  const notifier = useNotifier();
  const [items, setItems] = useState<LibraryAsset[]>([]);
  const [ringkasan, setRingkasan] = useState<LibrarySummary | null>(null);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [antrean, setAntrean] = useState<Antrean[]>([]);
  const [mengunggah, setMengunggah] = useState(false);
  const [cari, setCari] = useState('');
  const [kataTermuat, setKataTermuat] = useState('');
  const [saring, setSaring] = useState<LibraryFilter | null>(null);
  /** Aset yang sedang dicarikan sumber pengganti; null berarti dialognya tertutup. */
  const [gantiAset, setGantiAset] = useState<LibraryAsset | null>(null);
  /**
   * Tercentang secara bawaan: memindahkan video ke Bunny justru dilakukan untuk
   * melegakan disk VPS, jadi menyisakan berkas lamanya membatalkan tujuannya.
   * Tetap dapat dimatikan, dan yang akan hilang disebut namanya lebih dulu.
   */
  const [hapusLokal, setHapusLokal] = useState(true);

  /**
   * Pencarian dan penyaringan dikerjakan server sekarang.
   *
   * Sebelumnya seluruh perpustakaan diunduh sekaligus dan disaring di browser.
   * Itu benar selama isinya sedikit; begitu videonya banyak, setiap kunjungan
   * ke halaman ini menjadi satu pembacaan penuh tabel beserta seluruh
   * pemakaian tiap aset.
   */
  const load = useCallback(async (keyword: string, filter: LibraryFilter | null, page: number) => {
    setLoading(true);
    setError(null);
    try {
      let { items: batch, meta } = await ambilPerpustakaan({
        search: keyword || undefined,
        filter: filter ?? undefined,
        page,
      });
      // Menghapus baris terakhir sebuah halaman akan meninggalkan halaman
      // kosong yang hanya bisa ditinggalkan lewat tombol Sebelumnya. Dibawa
      // langsung ke halaman terakhir yang masih ada.
      if (batch.length === 0 && page > 1 && meta.totalPages >= 1) {
        ({ items: batch, meta } = await ambilPerpustakaan({
          search: keyword || undefined,
          filter: filter ?? undefined,
          page: meta.totalPages,
        }));
      }
      setItems(batch);
      setKataTermuat(keyword);
      setHalaman(meta.page);
      setTotalHalaman(meta.totalPages);
      setTotal(meta.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Perpustakaan gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Angka ringkasan berlaku untuk seluruh perpustakaan.
   *
   * Dulu ia dihitung dari baris yang kebetulan termuat — benar hanya karena
   * semuanya memang termuat. Dengan daftar yang berhalaman, cara itu akan
   * membuat "12 dipakai" berarti "12 dipakai di antara 20 yang sedang tampil".
   */
  const muatRingkasan = useCallback(async () => {
    try {
      setRingkasan(await ambilRingkasanPerpustakaan());
    } catch {
      // Hanya baris angka di atas daftar; kegagalannya tidak perlu menutupi isi.
    }
  }, []);

  // Kata kunci ditahan sebentar: pencarian kini menempuh jaringan.
  useEffect(() => {
    const timer = setTimeout(() => void load(cari.trim(), saring, 1), 250);
    return () => clearTimeout(timer);
  }, [load, cari, saring]);

  useEffect(() => {
    void muatRingkasan();
  }, [muatRingkasan]);

  function perbarui(key: string, patch: Partial<Antrean>) {
    setAntrean((current) =>
      current.map((entri) => (entri.key === key ? { ...entri, ...patch } : entri)),
    );
  }

  async function segarkan() {
    await Promise.all([load(kataTermuat, saring, halaman), muatRingkasan()]);
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
    // Yang baru diunggah berada di halaman pertama karena daftarnya terbaru dulu.
    await Promise.all([load(kataTermuat, saring, 1), muatRingkasan()]);
  }

  /**
   * Mengganti sumber video sebuah aset dengan video dari Bunny.
   *
   * Pelajaran yang memakainya tidak disentuh sama sekali — itulah gunanya
   * mengganti di perpustakaan alih-alih menempel ulang satu per satu. Satu aset
   * yang dipakai lima pelajaran berpindah lima-limanya sekaligus.
   */
  async function gantiSumber(video: BunnyVideo) {
    const aset = gantiAset;
    if (!aset || busy || mengunggah) return;
    setGantiAset(null);
    setBusy(aset.videoAssetId);
    try {
      const hasil = unwrap<Schemas['ReplaceVideoSourceResultDto']>(
        await browserClient().PUT('/api/v1/admin/videos/{videoAssetId}/source', {
          params: { path: { videoAssetId: aset.videoAssetId } },
          body: { source: video.guid, deleteLocalFile: hapusLokal },
        }),
      );
      await segarkan();
      notifier.success(
        hasil.status === 'AVAILABLE'
          ? `Sumber "${aset.title}" berpindah ke Bunny${hasil.localFileDeleted ? ' dan berkas lamanya dihapus' : ''}.`
          : `Sumber "${aset.title}" berpindah ke Bunny, tetapi videonya masih diproses Bunny.`,
      );
    } catch (caught) {
      void notifier.error('Sumber video gagal diganti', {
        text: caught instanceof ApiError ? caught.message : undefined,
        reasons: caught instanceof ApiError ? Object.values(caught.fields ?? {}).flat() : [],
      });
    } finally {
      setBusy(null);
    }
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
      await segarkan();
    } catch (caught) {
      void notifier.error('Video gagal dihapus', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  const selesai = antrean.filter((entri) => entri.status === 'SELESAI').length;
  const gagal = antrean.filter((entri) => entri.status === 'GAGAL').length;
  const disaring = kataTermuat !== '' || saring !== null;

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

      {ringkasan ? (
        <p className="muted">
          {disaring ? `${total} dari ${ringkasan.total} video` : `${ringkasan.total} video`} ·{' '}
          {formatBytes(ringkasan.totalBytes)} terpakai di disk
          {/* Angka inilah yang menjawab "apakah pemindahan ke Bunny berhasil".
              Tanpa disebut, disk yang menyusut terlihat seperti tidak terjadi
              apa-apa. */}
          {ringkasan.external > 0 ? ` · ${ringkasan.external} di penyedia luar` : ''} ·{' '}
          {ringkasan.used} dipakai pelajaran · {ringkasan.orphan} belum dipakai
          {ringkasan.problem > 0 ? ` · ${ringkasan.problem} bermasalah` : ''}
        </p>
      ) : null}

      {total > 0 || disaring ? (
        <section className="card filterCard" aria-label="Saring perpustakaan video">
          <div className="filterBar">
            <label className="userSearch">
              <span className="srOnly">Cari video</span>
              <span aria-hidden="true"><Search size={17} /></span>
              <input
                type="search"
                value={cari}
                onChange={(event) => setCari(event.target.value)}
                placeholder="Cari judul, nama berkas, atau pelajaran yang memakainya"
              />
            </label>
            <div className="inlineActions">
              {TAB.map(([nilai, label]) => (
                <button
                  key={label}
                  type="button"
                  className={saring === nilai ? 'btnTiny btnActive' : 'btnTiny'}
                  aria-pressed={saring === nilai}
                  onClick={() => setSaring(nilai)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <p className="muted">Memuat perpustakaan…</p>
      ) : items.length === 0 ? (
        <p className="muted">
          {disaring
            ? 'Tidak ada video yang cocok dengan penyaringan ini.'
            : 'Perpustakaan masih kosong. Unggah beberapa berkas di atas untuk memulai.'}
        </p>
      ) : (
        <>
          {/* `stack` melepas butir daftar bawaan dan `card` memberi panelnya;
              tanpa keduanya barisnya tampil sebagai daftar bertitik tanpa
              latar, seperti halaman yang gayanya gagal dimuat. */}
          <ul className="stack masterRecordList">
            {items.map((item) => (
              <li key={item.videoAssetId} className="card masterRecordCard">
                <div className="masterListHead">
                  <h2 className="cellTitle">{item.title}</h2>
                  <span className="pill">{namaPenyedia(item.provider)}</span>
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
                  <ActionMenu label="Aksi">
                  <button
                    type="button"
                    className="btnTiny"
                    disabled={busy === item.videoAssetId || mengunggah}
                    onClick={() => {
                      setHapusLokal(item.provider === 'SELF_HOSTED');
                      setGantiAset(item);
                    }}
                  >
                    Ganti sumber
                  </button>
                  <button
                    type="button"
                    className="btnTiny btnDanger"
                    // Dibiarkan dapat ditekan meski masih dipakai: pesan dari
                    // server menyebut berapa pelajaran yang memakainya, yang
                    // lebih berguna daripada tombol mati tanpa penjelasan.
                    disabled={busy === item.videoAssetId || mengunggah}
                    onClick={() => void hapus(item)}
                  >
                    {busy === item.videoAssetId ? 'Menghapus…' : 'Hapus'}
                  </button>
                  </ActionMenu>
                </div>
              </li>
            ))}
          </ul>

          {totalHalaman > 1 ? (
            <nav className="toolbar enrollmentPager" aria-label="Navigasi halaman perpustakaan">
              <button
                className="btn btnGhost"
                type="button"
                disabled={halaman <= 1 || loading}
                onClick={() => void load(kataTermuat, saring, halaman - 1)}
              >
                Sebelumnya
              </button>
              <span className="pill">
                Halaman {halaman} dari {totalHalaman} · {total} video
              </span>
              <button
                className="btn btnGhost"
                type="button"
                disabled={halaman >= totalHalaman || loading}
                onClick={() => void load(kataTermuat, saring, halaman + 1)}
              >
                Berikutnya
              </button>
            </nav>
          ) : null}
        </>
      )}

      {gantiAset ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Ganti sumber video">
          <div className="modalCard">
            <div className="masterListHead">
              <h2 className="cellTitle">Ganti sumber “{gantiAset.title}”</h2>
              <button
                className="btnTiny"
                type="button"
                onClick={() => setGantiAset(null)}
                disabled={busy !== null}
              >
                Tutup
              </button>
            </div>

            <p className="cellSub gantiSumberInfo">
              Sekarang {namaPenyedia(gantiAset.provider)}
              {gantiAset.originalName ? ` · ${gantiAset.originalName}` : ''} ·{' '}
              {formatBytes(gantiAset.sizeBytes)}
              {gantiAset.usedBy.length > 0
                ? ` · dipakai ${gantiAset.usedBy.length} pelajaran, semuanya ikut berpindah`
                : ' · belum dipakai pelajaran mana pun'}
            </p>

            {gantiAset.provider === 'SELF_HOSTED' ? (
              <label className="gantiSumberOpsi">
                <input
                  type="checkbox"
                  checked={hapusLokal}
                  disabled={busy !== null}
                  onChange={(event) => setHapusLokal(event.currentTarget.checked)}
                />
                <span>
                  Hapus berkas lama di server setelah berpindah
                  {gantiAset.originalName ? ` (${gantiAset.originalName}, ` : ' ('}
                  {formatBytes(gantiAset.sizeBytes)}). Berkasnya hilang dari disk dan hanya dapat
                  dikembalikan dari backup atau diunggah ulang.
                </span>
              </label>
            ) : null}

            <BunnyLibraryBrowser
              awalCari={gantiAset.title}
              busy={busy !== null}
              onPilih={(video) => void gantiSumber(video)}
              labelAksi="Pakai ini"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
