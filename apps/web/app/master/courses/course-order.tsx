'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../components/notifier';
import { StatusPill } from '../../components/status-pill';
import { ChevronDown, ChevronUp, GripVertical } from '../../components/icons';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';

type AdminCourse = Schemas['AdminCourseListItemDto'];

interface Props {
  courses: AdminCourse[];
  /** False bila daftarnya terpotong batas pengaman pengambilan. */
  lengkap: boolean;
}

/** Memindahkan satu elemen ke indeks lain tanpa mengubah larik asalnya. */
function pindahkan<T>(daftar: T[], dari: number, ke: number): T[] {
  if (dari === ke || dari < 0 || ke < 0 || dari >= daftar.length || ke >= daftar.length) {
    return daftar;
  }
  const salinan = [...daftar];
  const [diambil] = salinan.splice(dari, 1);
  salinan.splice(ke, 0, diambil!);
  return salinan;
}

function samaUrutannya(a: AdminCourse[], b: AdminCourse[]): boolean {
  return a.length === b.length && a.every((item, index) => item.id === b[index]!.id);
}

/**
 * Penyusun urutan katalog.
 *
 * Seluruh kursus dimuat sekaligus, tanpa pemenggalan halaman. Itu disengaja:
 * menyeret hanya dapat menjangkau apa yang tampak, jadi daftar yang dipenggal
 * dua puluh membuat kursus di halaman dua mustahil dipindahkan ke depan — persis
 * perpindahan yang paling sering diinginkan. Kotak nomor melengkapinya untuk
 * lompatan jauh yang tidak nyaman dilakukan dengan menyeret.
 *
 * Perubahan disimpan sekali lewat tombol, bukan pada setiap perpindahan. Satu
 * sesi penataan biasanya berisi banyak langkah, dan menyimpan tiap langkah akan
 * menulis ulang seluruh tabel berkali-kali serta meninggalkan belasan entri
 * audit untuk satu keputusan yang sama.
 */
export function CourseOrder({ courses, lengkap }: Props) {
  const router = useRouter();
  const notifier = useNotifier();
  const [urutan, setUrutan] = useState<AdminCourse[]>(courses);
  const [seret, setSeret] = useState<number | null>(null);
  const [nomor, setNomor] = useState<{ id: string; nilai: string } | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [kabar, setKabar] = useState('');
  const daftarRef = useRef<HTMLOListElement>(null);

  const berubah = !samaUrutannya(urutan, courses);

  /**
   * Menahan penutupan tab selagi ada urutan yang belum disimpan.
   *
   * Menata tiga puluh kursus lalu kehilangan seluruhnya karena satu tab
   * tertutup adalah kerugian yang tidak sebanding dengan biaya penjagaan ini.
   */
  useEffect(() => {
    if (!berubah) return;
    const jaga = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', jaga);
    return () => window.removeEventListener('beforeunload', jaga);
  }, [berubah]);

  /**
   * Salinan urutan terkini yang dapat dibaca seketika.
   *
   * Satu gerakan seret memicu beberapa perpindahan sebelum React sempat
   * merender ulang. Membaca `urutan` dari state akan membuat perpindahan kedua
   * bertolak dari susunan sebelum perpindahan pertama, dan barisnya melompat
   * mundur di tengah gerakan.
   */
  const urutanRef = useRef(urutan);
  useEffect(() => {
    urutanRef.current = urutan;
  }, [urutan]);

  const pindahKe = useCallback((dari: number, ke: number) => {
    const sekarang = urutanRef.current;
    const item = sekarang[dari];
    const hasil = pindahkan(sekarang, dari, ke);
    if (hasil === sekarang) return;
    urutanRef.current = hasil;
    setUrutan(hasil);
    if (item) setKabar(`${item.title} kini di urutan ${ke + 1}.`);
  }, []);

  // ── Menyeret ────────────────────────────────────────────────
  //
  // Memakai Pointer Events, bukan drag-and-drop bawaan HTML. Yang bawaan tidak
  // pernah terpicu oleh sentuhan, sehingga fitur ini akan mati sepenuhnya di
  // ponsel — padahal di sanalah Master paling sering merapikan katalog.
  //
  // Pendengarnya dipasang pada `window`, bukan pada barisnya, karena baris yang
  // sedang diseret dibuat tembus terhadap penunjuk (lihat `elementFromPoint` di
  // bawah) dan karenanya berhenti menerima peristiwanya sendiri.
  useEffect(() => {
    if (seret === null) return;

    const bergerak = (event: PointerEvent) => {
      event.preventDefault();

      // Menggulung sendiri di dekat tepi layar.
      //
      // `preventDefault` di atas mematikan gulungan bawaan selama menyeret,
      // jadi tanpa ini kursus di bawah lipatan tidak dapat dijangkau sama
      // sekali — dan pada daftar berisi puluhan kursus, itu berarti sebagian
      // besar tujuan perpindahan tidak terjangkau.
      const TEPI = 70;
      if (event.clientY < TEPI) {
        window.scrollBy({ top: -14 });
      } else if (event.clientY > window.innerHeight - TEPI) {
        window.scrollBy({ top: 14 });
      }

      const bawah = document.elementFromPoint(event.clientX, event.clientY);
      const baris = bawah?.closest<HTMLElement>('[data-indeks]');
      if (!baris || !daftarRef.current?.contains(baris)) return;

      const tujuan = Number.parseInt(baris.dataset.indeks ?? '', 10);
      if (Number.isNaN(tujuan) || tujuan === seret) return;

      // Ambang titik tengah. Tanpa ini, dua baris yang tingginya berbeda dapat
      // saling tukar bolak-balik saat penunjuk berhenti tepat di perbatasannya.
      const kotak = baris.getBoundingClientRect();
      const tengah = kotak.top + kotak.height / 2;
      if (tujuan > seret && event.clientY < tengah) return;
      if (tujuan < seret && event.clientY > tengah) return;

      pindahKe(seret, tujuan);
      setSeret(tujuan);
    };

    const lepas = () => setSeret(null);

    window.addEventListener('pointermove', bergerak, { passive: false });
    window.addEventListener('pointerup', lepas);
    window.addEventListener('pointercancel', lepas);
    return () => {
      window.removeEventListener('pointermove', bergerak);
      window.removeEventListener('pointerup', lepas);
      window.removeEventListener('pointercancel', lepas);
    };
  }, [seret, pindahKe]);

  // ── Kotak nomor ─────────────────────────────────────────────

  function terapkanNomor(index: number): void {
    if (!nomor) return;
    const diminta = Number.parseInt(nomor.nilai, 10);
    setNomor(null);
    if (Number.isNaN(diminta)) return;
    // Dijepit ke rentang yang ada. Mengetik 0 atau 99 adalah cara wajar orang
    // mengatakan "paling depan" dan "paling belakang"; menolaknya dengan galat
    // hanya menghukum maksud yang sudah jelas.
    const tujuan = Math.min(Math.max(diminta, 1), urutan.length) - 1;
    pindahKe(index, tujuan);
  }

  // ── Menyimpan ───────────────────────────────────────────────

  async function simpan(): Promise<void> {
    if (menyimpan) return;
    setMenyimpan(true);
    try {
      unwrap(
        await browserClient().PUT('/api/v1/admin/courses/order', {
          body: { ids: urutan.map((course) => course.id) },
        }),
      );
      notifier.success('Urutan katalog tersimpan.');
      router.push('/master/courses');
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        // `fields.order` berisi alasan penolakan yang sesungguhnya — misalnya
        // daftar kursus berubah sejak halaman dibuka. Tanpa menampilkannya,
        // yang terbaca hanya "gagal" tanpa satu pun petunjuk apa yang harus
        // dilakukan.
        void notifier.error('Urutan belum tersimpan', {
          text: caught.message,
          reasons: caught.fields?.order ?? [],
        });
      } else {
        void notifier.error('Tidak dapat menghubungi server', {
          text: 'Urutan belum tersimpan. Periksa koneksimu lalu coba lagi.',
        });
      }
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <section className="card orderCard" aria-label="Susun urutan katalog">
      <div className="orderHead">
        <div>
          <p className="orderLead">
            Seret pegangan untuk memindahkan, atau ketik nomor urutnya lalu tekan Enter.
            Urutan ini yang dilihat pelajar di halaman Kursus.
          </p>
          {!lengkap ? (
            <p className="orderWarn">
              Daftar ini terpotong batas pengaman, jadi belum seluruh kursus tampil. Menyimpan
              sekarang akan menyusun ulang hanya yang tampak — rapikan jumlah kursusnya lebih
              dulu.
            </p>
          ) : null}
        </div>
        <div className="orderActions">
          <button
            type="button"
            className="btn btnGhost"
            onClick={() => {
              setUrutan(courses);
              setKabar('Urutan dikembalikan seperti semula.');
            }}
            disabled={!berubah || menyimpan}
          >
            Kembalikan
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void simpan()}
            disabled={!berubah || menyimpan || !lengkap}
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan urutan'}
          </button>
        </div>
      </div>

      {/* Perpindahan diumumkan supaya pembaca layar tahu hasilnya; menyeret dan
          menekan panah sama-sama tidak menghasilkan bunyi apa pun sendiri. */}
      <p className="srOnly" role="status" aria-live="polite">
        {kabar}
      </p>

      <ol className="orderList" ref={daftarRef}>
        {urutan.map((course, index) => (
          <li
            key={course.id}
            data-indeks={index}
            className={`orderRow${seret === index ? ' orderRowDragging' : ''}`}
          >
            <button
              type="button"
              className="orderGrip"
              aria-label={`Pindahkan ${course.title}. Urutan sekarang ${index + 1} dari ${urutan.length}. Pakai panah atas dan bawah.`}
              onPointerDown={(event) => {
                // Hanya tombol kiri tetikus atau sentuhan; klik kanan tidak
                // boleh memulai perpindahan yang tak bisa dibatalkan.
                if (event.button !== 0) return;
                setSeret(index);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  pindahKe(index, index - 1);
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  pindahKe(index, index + 1);
                }
              }}
            >
              <GripVertical size={17} />
            </button>

            <label className="orderNumber">
              <span className="srOnly">Nomor urut {course.title}</span>
              <input
                type="number"
                min={1}
                max={urutan.length}
                inputMode="numeric"
                value={nomor?.id === course.id ? nomor.nilai : index + 1}
                onChange={(event) => setNomor({ id: course.id, nilai: event.target.value })}
                onBlur={() => terapkanNomor(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === 'Escape') {
                    setNomor(null);
                  }
                }}
              />
            </label>

            <span className={`courseThumb${course.thumbnailUrl ? ' hasImage' : ''}`} aria-hidden="true">
              {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" /> : course.title.slice(0, 1)}
            </span>

            <span className="orderTitle">
              <span className="cellTitle">{course.title}</span>
              <span className="cellSub">
                {course.category?.name ?? 'Tanpa kategori'} · {course.moduleCount} bagian
              </span>
            </span>

            <StatusPill status={course.status} />

            {/* Panah tetap ada di samping pegangan. Menyeret sudah bekerja di
                sentuhan, tetapi memindahkan satu langkah dengan tepat lebih
                mudah ditekan daripada dibidik. */}
            <span className="orderNudge">
              <button
                type="button"
                className="btnTiny"
                onClick={() => pindahKe(index, index - 1)}
                disabled={index === 0}
                aria-label={`Naikkan ${course.title}`}
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                className="btnTiny"
                onClick={() => pindahKe(index, index + 1)}
                disabled={index === urutan.length - 1}
                aria-label={`Turunkan ${course.title}`}
              >
                <ChevronDown size={15} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
