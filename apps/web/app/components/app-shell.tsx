import type { ReactNode } from 'react';
import Link from 'next/link';
import type { CurrentUser } from '../lib/session';
import { can, initials } from '../lib/session';
import { LogoutButton } from './logout-button';
import { NavLink } from './nav-link';
import { ThemeToggle } from './theme-toggle';

const LEARNER_NAV = [
  { href: '/', label: 'Beranda' },
  { href: '/courses', label: 'Kursus' },
];

/** Hanya muncul bagi pemegang `courses.manage`. */
const MASTER_NAV = [{ href: '/master', label: 'Kelola' }];

/** Kerangka halaman untuk area yang membutuhkan autentikasi. */
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="LMS Akademi Online, ke beranda">
          <span className="brandMark" aria-hidden="true">
            AO
          </span>
          <span>Akademi Online</span>
        </Link>

        <nav className="mainNav" aria-label="Navigasi utama">
          {[...LEARNER_NAV, ...(can(user, 'courses.manage') ? MASTER_NAV : [])].map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbarRight">
          <ThemeToggle />
          <LogoutButton />
          <span className="avatar" title={`${user.fullName} (${user.role})`}>
            <span aria-hidden="true">{initials(user.fullName)}</span>
            <span className="srOnly">
              Masuk sebagai {user.fullName}, peran {user.role}
            </span>
          </span>
        </div>
      </header>
      {children}
    </>
  );
}
