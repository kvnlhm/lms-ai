'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../components/notifier';
import { browserClient, unwrap } from '../lib/browser-api';

type HistoryItem = Schemas['LearningHistoryItemDto'];
type HistoryPage = Schemas['LearningHistoryPageDto'];

const UKURAN_HALAMAN = 20;

/** Menit dan detik yang wajar dibaca; nol berarti tidak usah disebut. */
function formatDurasi(detik: number): string | null {
  if (detik <= 0) return null;
  if (detik < 60) return `${detik} detik`;
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa === 0 ? `${jam} jam` : `${jam}j ${sisa}m`;
}

const TANGGAL = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
});
const JAM = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});
/** Kunci hari menurut zona waktu yang sama dengan yang ditampilkan. */
const HARI = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });

function labelHari(waktu: Date, sekarang: Date): string {
  const hari = HARI.format(waktu);
  if (hari === HARI.format(sekarang)) return 'Hari ini';
  const kemarin = new Date(sekarang.getTime() - 86_400_000);
  if (hari === HARI.format(kemarin)) return 'Kemarin';
  return TANGGAL.format(waktu);
}

/**
 * Riwayat belajar, dikelompokkan per hari dan menumpuk ke belakang.
 *
 * Sebelumnya halaman ini hanya punya satu tautan "Aktivitas sebelumnya" yang
 * menggantikan seluruh isinya. Sekali ditekan, tidak ada jalan kembali selain
 * menyunting URL — riwayat yang baru saja dibaca hilang dari layar. Menumpuk
 * membuat perjalanan itu satu arah tanpa kehilangan apa pun.
 */
export function HistoryList({ initial }: { initial: HistoryPage }) {
  const notifier = useNotifier();
  const [items, setItems] = useState<HistoryItem[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor ?? null);
  const [memuat, setMemuat] = useState(false);
  const sekarang = new Date();

  function muatLagi() {
    if (!cursor || memuat) return;
    setMemuat(true);
    void (async () => {
      try {
        const lanjutan = unwrap<HistoryPage>(
          await browserClient().GET('/api/v1/me/learning-history', {
            params: { query: { limit: UKURAN_HALAMAN, cursor } },
          }),
        );
        // Disaring terhadap yang sudah ada: peristiwa baru yang masuk di antara
        // dua permintaan menggeser jendelanya, dan id yang sama tidak boleh
        // dirender dua kali.
        setItems((current) => {
          const ada = new Set(current.map((item) => item.id));
          return [...current, ...lanjutan.items.filter((item) => !ada.has(item.id))];
        });
        setCursor(lanjutan.nextCursor ?? null);
      } catch (error) {
        void notifier.error('Aktivitas lama gagal dimuat', {
          text: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setMemuat(false);
      }
    })();
  }

  if (items.length === 0) {
    return (
      <div className="card emptyCard">
        <p>Belum ada aktivitas belajar.</p>
        <p className="muted">
          Riwayat terisi sendiri begitu kamu membuka atau menyelesaikan sebuah pelajaran.
        </p>
        <Link className="btnSecondary" href="/courses">Lihat katalog kursus</Link>
      </div>
    );
  }

  // Dikelompokkan sambil berjalan, bukan diurutkan ulang: server sudah
  // mengirimnya menurun, dan mengurutkan ulang di sini hanya menambah cara
  // baru untuk salah.
  const kelompok: { hari: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const hari = labelHari(new Date(item.occurredAt), sekarang);
    const terakhir = kelompok.at(-1);
    if (terakhir?.hari === hari) terakhir.items.push(item);
    else kelompok.push({ hari, items: [item] });
  }

  return (
    <>
      {kelompok.map((grup) => (
        <section key={grup.hari} className="historyDay">
          <h2 className="historyDayLabel">{grup.hari}</h2>
          <div className="card historyList">
            {grup.items.map((item) => {
              const selesai = item.activityType === 'LESSON_COMPLETED';
              // Kontraknya menandai kedua kolom ini opsional sekaligus nullable,
              // jadi keduanya diperlakukan sama: tidak ada berarti tidak disebut.
              const durasi = item.durationSeconds == null ? null : formatDurasi(item.durationSeconds);
              const progres = item.progressAfter == null ? null : Math.round(item.progressAfter);
              return (
                <article key={item.id} className="historyItem">
                  <span className={selesai ? 'historyDot complete' : 'historyDot'} />
                  <div>
                    <span className="eyebrow">{selesai ? 'Pelajaran selesai' : 'Pelajaran dibuka'}</span>
                    <h3>{item.lessonTitle}</h3>
                    <p>{item.courseTitle}{item.moduleTitle ? ` · ${item.moduleTitle}` : ''}</p>
                    <p className="historyFacts">
                      <time dateTime={item.occurredAt}>{JAM.format(new Date(item.occurredAt))}</time>
                      {/* Durasi dan progres sudah lama ikut terkirim dan
                          dibuang begitu saja di halaman ini. */}
                      {durasi ? <span>{durasi}</span> : null}
                      {selesai && progres !== null ? (
                        <span>Progres kursus {progres}%</span>
                      ) : null}
                    </p>
                  </div>
                  {item.lessonId && item.courseId ? (
                    <Link className="btnTiny" href={`/learn/${item.courseId}/${item.lessonId}`}>Buka</Link>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {cursor ? (
        <div className="muatLagi">
          <button type="button" className="btnSecondary" disabled={memuat} onClick={muatLagi}>
            {memuat ? 'Memuat…' : 'Muat aktivitas lama'}
          </button>
        </div>
      ) : null}
    </>
  );
}
