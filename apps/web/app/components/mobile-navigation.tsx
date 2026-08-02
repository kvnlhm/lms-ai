'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BrandMark } from './brand-mark';

export function MobileNavigation({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="mobileNavigation">
      <button
        type="button"
        className="mobileMenuButton"
        aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="hamburgerIcon">
          <i />
          <i />
          <i />
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="mobileDrawerOverlay"
            aria-label="Tutup menu navigasi"
            onClick={() => setOpen(false)}
          />
          <aside id={panelId} className="mobileDrawer" aria-label={title}>
            <div className="mobileDrawerHead">
              <div>
                <BrandMark />
                <strong>{title}</strong>
              </div>
              <button type="button" className="mobileDrawerClose" onClick={() => setOpen(false)}>
                <span aria-hidden="true">×</span>
                <span className="srOnly">Tutup menu</span>
              </button>
            </div>
            <div className="mobileDrawerBody" onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) setOpen(false);
            }}>
              {children}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
