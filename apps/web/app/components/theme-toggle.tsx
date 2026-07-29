'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'lms-theme';

/**
 * Tombol tema terang/gelap.
 *
 * Sebelum pengguna memilih, tampilan mengikuti preferensi sistem lewat
 * `prefers-color-scheme`. Pilihan eksplisit disimpan dan dipasang sebagai
 * `data-theme` pada elemen root, yang menang atas media query di kedua arah.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
      return;
    }
    setTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  // Sebelum efek pertama berjalan, tema belum diketahui. Tombol tetap dirender
  // agar tata letak tidak bergeser, tetapi ikonnya belum ditentukan.
  const isDark = theme !== 'light';
  const label = isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap';

  return (
    <button type="button" className="iconBtn" onClick={toggle} title={label} aria-label={label}>
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
          </>
        ) : (
          <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
        )}
      </svg>
    </button>
  );
}
