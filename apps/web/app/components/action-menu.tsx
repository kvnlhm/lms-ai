'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface Posisi {
  left: number;
  /** Salah satu diisi: panel dijatuhkan ke bawah tombol, atau dinaikkan bila tidak muat. */
  top?: number;
  bottom?: number;
}

/** Tinggi kira-kira panel terpanjang; hanya dipakai untuk memutuskan arah buka. */
const PERKIRAAN_TINGGI = 260;
const JARAK = 6;

/**
 * Menu tindakan yang ringkas di tabel dan editor.
 *
 * Panelnya `position: fixed`, bukan `absolute`, dan itu bukan pilihan gaya.
 * Menu ini hidup di dalam tabel yang dapat digeser mendatar, dan wadah yang
 * dapat digeser memotong apa pun yang keluar darinya. Sebelumnya jalan
 * keluarnya adalah mematikan `overflow` wadah tabel pada layar lebar: panelnya
 * memang tidak terpotong lagi, tetapi tabel yang lebih lebar dari kartunya
 * menjadi mustahil digeser, sehingga kolom terakhir — termasuk tombol ini —
 * terpotong tanpa cara mencapainya sama sekali.
 *
 * Dengan panel yang lepas dari alur, wadah tabel boleh kembali dapat digeser
 * dan panelnya tetap utuh. Koordinatnya dihitung saat dibuka, karena letak
 * tombolnya bergantung pada seberapa jauh tabel sudah digeser.
 */
export function ActionMenu({ children, label = 'Aksi' }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [posisi, setPosisi] = useState<Posisi | null>(null);

  const tempatkan = useCallback(() => {
    const summary = ref.current?.querySelector('summary');
    if (!summary) return;
    const kotak = summary.getBoundingClientRect();
    const muatDiBawah = kotak.bottom + PERKIRAAN_TINGGI < window.innerHeight;
    setPosisi({
      // Ditambatkan pada tepi kanan tombol; panelnya melebar ke kiri.
      left: kotak.right,
      ...(muatDiBawah
        ? { top: kotak.bottom + JARAK }
        : { bottom: window.innerHeight - kotak.top + JARAK }),
    });
  }, []);

  const tutup = useCallback(() => {
    if (ref.current?.open) ref.current.open = false;
  }, []);

  useEffect(() => {
    if (!posisi) return undefined;
    // Menggulir atau mengubah ukuran memindahkan tombolnya sementara panel
    // tetap di koordinat lamanya. Ditutup saja: memindahkan panel yang sedang
    // dibaca lebih membingungkan daripada menutupnya.
    const onScroll = () => tutup();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') tutup();
    };
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) tutup();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [posisi, tutup]);

  return (
    <details
      ref={ref}
      className="actionMenu"
      onToggle={(event) => {
        if (event.currentTarget.open) tempatkan();
        else setPosisi(null);
      }}
    >
      <summary aria-label={label}>
        {label}
        <span aria-hidden="true">⌄</span>
      </summary>
      {posisi ? (
        <div
          className="actionMenuPanel"
          style={{
            top: posisi.top,
            bottom: posisi.bottom,
            left: posisi.left,
            // Panel ditarik ke kiri sepanjang lebarnya sendiri, sehingga tepi
            // kanannya berhimpit dengan tepi kanan tombol tanpa perlu mengukur
            // lebar panel lebih dulu.
            transform: 'translateX(-100%)',
          }}
          onClick={() => tutup()}
        >
          {children}
        </div>
      ) : null}
    </details>
  );
}
