'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from './icons';

/**
 * Navigasi Master untuk layar sentuh.
 *
 * Menggantikan hamburger dan laci samping — tetapi hanya di sisi Master.
 * Sisi pelajar tetap memakai `MobileNavigation` beserta seluruh kelas
 * `.mobileDrawer*` yang tidak disentuh sama sekali dari sini, karena halaman
 * pelajar sudah dipakai pembeli kursus dan tidak boleh ikut berubah.
 *
 * Bentuknya dua bagian:
 *
 * - Bilah bawah tetap berisi tujuan yang paling sering dibuka. Ibu jari
 *   mencapai tepi bawah layar tanpa memindahkan genggaman; sudut kiri atas —
 *   tempat hamburger berada — justru yang paling jauh.
 * - Lembar bawah untuk sisanya, termasuk profil dan keluar. Dibuka dari
 *   tombol terakhir pada bilah.
 */

export interface MasterNavItem {
  href: string;
  label: string;
  /**
   * Ikon yang sudah dirender, bukan komponennya.
   *
   * `AppShell` adalah server component sedangkan berkas ini client component,
   * dan fungsi tidak dapat menyeberangi batas keduanya — melewatkan komponen
   * ikon ke sini membuat seluruh halaman Master gagal dirender. Elemen React
   * yang sudah jadi dapat diserialisasi, jadi ukurannya ditentukan di sisi
   * server saat elemennya dibuat.
   */
  icon: ReactNode;
}

export function MasterMobileNav({
  primary,
  secondary,
  sheetHeader,
  sheetFooter,
}: {
  /** Tujuan pada bilah bawah. Maksimal empat, supaya labelnya tetap terbaca. */
  primary: MasterNavItem[];
  /** Sisanya, tampil di dalam lembar bawah. */
  secondary: MasterNavItem[];
  sheetHeader: ReactNode;
  sheetFooter: ReactNode;
}) {
  const pathname = usePathname();
  const [terbuka, setTerbuka] = useState(false);

  useEffect(() => setTerbuka(false), [pathname]);

  return (
    <>
      <nav className="masterTabBar" aria-label="Navigasi Master">
        {primary.map((item) => {
          const aktif = item.href === '/master' ? pathname === '/master' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="masterTab"
              aria-current={aktif ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className="masterTab"
          aria-expanded={terbuka}
          onClick={() => setTerbuka(true)}
        >
          <MoreHorizontal size={21} />
          <span>Lainnya</span>
        </button>
      </nav>

      {terbuka ? (
        <MasterSheet onClose={() => setTerbuka(false)} header={sheetHeader} footer={sheetFooter}>
          {secondary.map((item) => (
            <Link key={item.href} href={item.href} className="masterSheetRow">
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </MasterSheet>
      ) : null}
    </>
  );
}

function MasterSheet({
  children,
  header,
  footer,
  onClose,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sebelumnya = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;

      const fokusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [onClose]);

  return (
    <div
      className="masterSheetBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className="masterSheet"
        role="dialog"
        aria-modal="true"
        aria-label="Menu Master lainnya"
        tabIndex={-1}
      >
        {/* Batang penanda bahwa lembar ini dapat ditutup. Menutupnya lewat
            ketuk latar, tombol Escape, atau memilih salah satu tujuan. */}
        <span className="masterSheetGrip" aria-hidden="true" />
        <div className="masterSheetHead">{header}</div>
        <div className="masterSheetBody">{children}</div>
        <div className="masterSheetFoot">{footer}</div>
      </div>
    </div>
  );
}
