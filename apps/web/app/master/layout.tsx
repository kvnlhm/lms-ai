import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Judul tab untuk seluruh sisi Master.
 *
 * Hanya menetapkan metadata, tidak menambah markup apa pun: kerangka
 * halamannya sudah dibangun AppShell. Halaman Master yang menetapkan judulnya
 * sendiri — Insight, Forum, Audit log, dan seterusnya — tetap memakai judulnya.
 */
export const metadata: Metadata = {
  title: {
    default: 'Master · Academy AIPreneur',
    template: '%s · Master',
  },
};

export default function MasterLayout({ children }: { children: ReactNode }) {
  return children;
}
