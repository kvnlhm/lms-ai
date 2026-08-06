'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../components/notifier';
import { StatusPill } from '../../components/status-pill';
import { ArrowLeft, ArrowRight, GripVertical } from '../../components/icons';
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
  const visualSeretRef = useRef<{ elemen: HTMLElement; offsetX: number; offsetY: number } | null>(null);

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
    const posisiLama = new Map(
      [...(daftarRef.current?.querySelectorAll<HTMLElement>('[data-course-id]') ?? [])]
        .map((element) => [element.dataset.courseId!, element.getBoundingClientRect()] as const),
    );
    urutanRef.current = hasil;
    setUrutan(hasil);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        daftarRef.current?.querySelectorAll<HTMLElement>('[data-course-id]').forEach((element) => {
          const lama = posisiLama.get(element.dataset.courseId!);
          if (!lama) return;
          const baru = element.getBoundingClientRect();
          const x = lama.left - baru.left;
          const y = lama.top - baru.top;
          if (x === 0 && y === 0) return;
          element.animate(
            [{ transform: `translate3d(${x}px, ${y}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
            { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
          );
        });
      }));
    }
    if (item) setKabar(`${item.title} kini di urutan ${ke + 1}.`);
  }, []);

  function mulaiSeret(event: ReactPointerEvent<HTMLButtonElement>, index: number): void {
    if (event.button !== 0) return;
    const kartu = event.currentTarget.closest<HTMLElement>('[data-course-id]');
    if (!kartu) return;
    event.preventDefault();
    const kotak = kartu.getBoundingClientRect();
    const visual = kartu.cloneNode(true) as HTMLElement;
    visual.removeAttribute('data-indeks');
    visual.removeAttribute('data-course-id');
    visual.setAttribute('aria-hidden', 'true');
    visual.setAttribute('inert', '');
    visual.classList.add('orderDragGhost');
    visual.style.width = `${kotak.width}px`;
    visual.style.height = `${kotak.height}px`;
    visual.style.transform = `translate3d(${kotak.left}px, ${kotak.top}px, 0)`;
    document.body.append(visual);
    visualSeretRef.current = {
      elemen: visual,
      offsetX: event.clientX - kotak.left,
      offsetY: event.clientY - kotak.top,
    };
    setSeret(index);
  }

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
      const visual = visualSeretRef.current;
      if (visual) {
        visual.elemen.style.transform = `translate3d(${event.clientX - visual.offsetX}px, ${event.clientY - visual.offsetY}px, 0)`;
      }

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
      const kartu = bawah?.closest<HTMLElement>('[data-indeks]');
      const daftar = daftarRef.current;
      if (!daftar) return;
      let tujuan = kartu && daftar.contains(kartu)
        ? Number.parseInt(kartu.dataset.indeks ?? '', 10)
        : Number.NaN;
      if (Number.isNaN(tujuan)) {
        const batas = daftar.getBoundingClientRect();
        if (event.clientX < batas.left || event.clientX > batas.right || event.clientY < batas.top || event.clientY > batas.bottom) return;
        let jarak = Number.POSITIVE_INFINITY;
        daftar.querySelectorAll<HTMLElement>('[data-indeks]').forEach((calon) => {
          const kotak = calon.getBoundingClientRect();
          const nilai = Math.hypot(event.clientX - (kotak.left + kotak.width / 2), event.clientY - (kotak.top + kotak.height / 2));
          if (nilai < jarak) {
            jarak = nilai;
            tujuan = Number.parseInt(calon.dataset.indeks ?? '', 10);
          }
        });
      }
      if (Number.isNaN(tujuan) || tujuan === seret) return;

      // Tidak ada ambang titik tengah di sini, tidak seperti pada daftar
      // menurun. Kartunya tersusun sebagai kisi, jadi tetangga sebuah kartu bisa
      // berada di kanan atau di bawahnya — dan ambang satu sumbu justru salah
      // pada separuh arah. Yang menjaganya tetap tenang adalah kartu yang sedang
      // diseret dibuat tembus terhadap penunjuk: begitu ia menempati posisi
      // tujuan, penunjuk berada di atas dirinya sendiri dan tidak menemukan
      // kartu lain sampai benar-benar digerakkan ke kartu berikutnya.
      pindahKe(seret, tujuan);
      setSeret(tujuan);
    };

    const lepas = () => {
      visualSeretRef.current?.elemen.remove();
      visualSeretRef.current = null;
      setSeret(null);
    };

    window.addEventListener('pointermove', bergerak, { passive: false });
    window.addEventListener('pointerup', lepas);
    window.addEventListener('pointercancel', lepas);
    return () => {
      window.removeEventListener('pointermove', bergerak);
      window.removeEventListener('pointerup', lepas);
      window.removeEventListener('pointercancel', lepas);
    };
  }, [seret, pindahKe]);

  useEffect(() => () => visualSeretRef.current?.elemen.remove(), []);

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

      {/* Kartunya sengaja meniru katalog pelajar: sampul di atas, judul dan
          kategori di bawahnya. Yang ditata Master adalah benda yang sama dengan
          yang dilihat pelajar, jadi menatanya dalam bentuk yang sama pula
          menghapus satu langkah penerjemahan di kepala — "baris ketiga dari
          atas" tidak lagi perlu dibayangkan sebagai "kartu di baris dua kolom
          satu". Bilah kemajuan belajar tidak ikut; ia milik pelajar, dan di
          sini hanya akan menambah tinggi kartu tanpa menambah keterangan. */}
      <ol className="courseGrid orderGrid" ref={daftarRef}>
        {urutan.map((course, index) => (
          <li
            key={course.id}
            data-indeks={index}
            data-course-id={course.id}
            className={`card orderCardItem${seret === index ? ' orderCardDragging' : ''}`}
          >
            <span className={`cover${course.thumbnailUrl ? ' hasImage' : ''}`}>
              {course.thumbnailUrl ? (
                <img src={course.thumbnailUrl} alt="" />
              ) : (
                <span className="coverText">{course.title}</span>
              )}

              <span className="orderBadge">
                <button
                  type="button"
                  className="orderGrip"
                  aria-label={`Pindahkan ${course.title}. Urutan sekarang ${index + 1} dari ${urutan.length}. Pakai tombol panah untuk menggeser satu langkah.`}
                  onPointerDown={(event) => {
                    mulaiSeret(event, index);
                  }}
                  onKeyDown={(event) => {
                    // Kiri dan atas sama-sama mundur satu, kanan dan bawah maju
                    // satu. Pada kisi, "atas" sesungguhnya berarti satu baris
                    // penuh, tetapi jumlah kolomnya ditentukan lebar layar dan
                    // tidak diketahui di sini — memindahkan satu langkah adalah
                    // satu-satunya tafsir yang selalu benar.
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      pindahKe(index, index - 1);
                    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                      event.preventDefault();
                      pindahKe(index, index + 1);
                    }
                  }}
                >
                  <GripVertical size={16} />
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
              </span>
            </span>

            <div className="orderCardBody">
              <span className="courseName">{course.title}</span>
              <span className="eyebrow courseCategory">
                {course.category?.name ?? 'Tanpa kategori'} · {course.moduleCount} bagian
              </span>

              <div className="orderCardFoot">
                <StatusPill status={course.status} />
                {/* Panah tetap ada di samping pegangan. Menyeret sudah bekerja
                    di sentuhan, tetapi memindahkan satu langkah dengan tepat
                    lebih mudah ditekan daripada dibidik. */}
                <span className="orderNudge">
                  <button
                    type="button"
                    className="btnTiny"
                    onClick={() => pindahKe(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Majukan ${course.title}`}
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className="btnTiny"
                    onClick={() => pindahKe(index, index + 1)}
                    disabled={index === urutan.length - 1}
                    aria-label={`Mundurkan ${course.title}`}
                  >
                    <ArrowRight size={15} />
                  </button>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
