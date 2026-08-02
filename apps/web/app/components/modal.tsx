'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from './icons';

/**
 * Wadah dialog untuk formulir.
 *
 * Berbeda dari dialog pada `notifier.tsx`, yang menyampaikan pesan singkat dan
 * menutup sendiri setelah dijawab. Yang ini menampung formulir: isinya panjang,
 * dapat digulir, dan tombol aksinya tetap terlihat di bawah.
 *
 * Lapisannya sengaja di bawah `notifier` (z-index 200). Ketika penyimpanan
 * gagal, dialog galat harus muncul di atas formulir yang sedang terbuka —
 * bukan tersembunyi di belakangnya — supaya penyebabnya terbaca tanpa menutup
 * apa yang sudah diketik.
 *
 * Pada layar sempit tampil memenuhi layar. Formulir dengan enam sampai sepuluh
 * kolom tidak muat di dalam kotak mengambang di ponsel, dan menyusutkannya
 * hanya memindahkan sesaknya ke dalam.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  /** Menahan penutupan selama penyimpanan berjalan. */
  busy = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const tutup = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sebelumnya = document.activeElement as HTMLElement | null;

    // Fokus jatuh ke kolom isian pertama, bukan ke tombol tutup: pengguna
    // membuka formulir untuk mengisi, bukan untuk menutupnya.
    const isian = panel.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    (isian ?? tutup.current)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busy) onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;

      const fokusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const pertama = fokusable[0];
      const terakhir = fokusable[fokusable.length - 1];
      if (!pertama || !terakhir) return;

      if (event.shiftKey && document.activeElement === pertama) {
        event.preventDefault();
        terakhir.focus();
      } else if (!event.shiftKey && document.activeElement === terakhir) {
        event.preventDefault();
        pertama.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const gulirSemula = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = gulirSemula;
      sebelumnya?.focus();
    };
  }, [busy, onClose]);

  return (
    <div
      className="formModalBackdrop"
      onMouseDown={(event) => {
        // Klik latar tidak menutup formulir yang sedang diisi: satu klik
        // meleset akan membuang seluruh isian tanpa cara mengembalikannya.
        // Penutupan lewat tombol tutup, Batal, atau Escape — semuanya disengaja.
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div
        ref={panel}
        className="formModalPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="formModalTitle"
        aria-describedby={description ? 'formModalDescription' : undefined}
      >
        <div className="formModalHead">
          <div className="formModalHeadText">
            <h2 id="formModalTitle">{title}</h2>
            {description ? <p id="formModalDescription">{description}</p> : null}
          </div>
          <button
            ref={tutup}
            type="button"
            className="formModalClose"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup formulir"
          >
            <X size={18} />
          </button>
        </div>

        <div className="formModalBody">{children}</div>
      </div>
    </div>
  );
}
