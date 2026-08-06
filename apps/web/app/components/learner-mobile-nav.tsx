'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, MessageCircle, Search, X } from './icons';
import { GlobalSearch } from './global-search';

const items = [
  { href: '/notifications', label: 'Notifikasi', icon: Bell },
  { href: '/community', label: 'Komunitas', icon: MessageCircle },
] as const;

export function LearnerMobileNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => setSearchOpen(false), [pathname]);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [searchOpen]);

  return (
    <>
      <nav className="learnerBottomNav" aria-label="Navigasi utama Pelajar">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="learnerBottomLink" aria-current={active ? 'page' : undefined}>
              <span className="learnerBottomIcon">
                <Icon size={23} />
                {href === '/notifications' && unread > 0 ? (
                  <span className="learnerBottomBadge" aria-label={`${unread} notifikasi belum dibaca`}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
        <button type="button" className="learnerBottomLink" aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}>
          <span className="learnerBottomIcon"><Search size={24} /></span>
          <span>Cari</span>
        </button>
      </nav>

      {searchOpen ? (
        <section className="learnerSearchSheet" role="dialog" aria-modal="true" aria-labelledby="learnerSearchTitle">
          <header>
            <h2 id="learnerSearchTitle">Pencarian</h2>
            <button type="button" className="learnerSearchClose" onClick={() => setSearchOpen(false)}>
              <X size={25} /><span className="srOnly">Tutup pencarian</span>
            </button>
          </header>
          <GlobalSearch idPrefix="learnerMobileSearch" />
          <div className="learnerSearchHint">
            <Search size={48} />
            <p>Cari kursus, materi, forum, dan pengumuman.</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
