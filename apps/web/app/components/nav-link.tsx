'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Tautan navigasi yang menandai halaman aktif lewat `aria-current`.
 * Penanda ini sekaligus menjadi kait styling, jadi status aktif tidak pernah
 * hanya tersampaikan lewat warna.
 */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const isActive =
    href === '/' || href === '/master' ? pathname === href : pathname.startsWith(href);

  return (
    <Link href={href} className="navLink" aria-current={isActive ? 'page' : undefined}>
      {children}
    </Link>
  );
}
