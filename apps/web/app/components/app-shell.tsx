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

const MASTER_NAV = [
  { href: '/master', label: 'Kelola', permission: 'courses.manage' },
  { href: '/master/users', label: 'Pengguna', permission: 'users.read' },
] as const;

/** Kerangka halaman untuk area yang membutuhkan autentikasi. */
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="LMS AIPrenuer, ke beranda">
          <span className="brandMark" aria-hidden="true">
            AO
          </span>
          <span>AIPrenuer</span>
        </Link>

        <nav className="mainNav" aria-label="Navigasi utama">
          {[
            ...LEARNER_NAV,
            ...MASTER_NAV.filter((item) => can(user, item.permission)),
          ].map((item) => (
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
