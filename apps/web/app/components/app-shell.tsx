import type { ReactNode } from 'react';
import Link from 'next/link';
import type { CurrentUser } from '../lib/session';
import { can, initials } from '../lib/session';
import { Courses, Dashboard, ExternalLink, Users } from './icons';
import { LogoutButton } from './logout-button';
import { NavLink } from './nav-link';
import { ThemeToggle } from './theme-toggle';

const LEARNER_NAV = [
  { href: '/', label: 'Beranda' },
  { href: '/courses', label: 'Kursus' },
  { href: '/history', label: 'Histori' },
];

const MASTER_NAV = [
  { href: '/master', label: 'Dashboard', icon: Dashboard, permission: 'courses.manage' },
  { href: '/master/courses', label: 'Kursus', icon: Courses, permission: 'courses.manage' },
  { href: '/master/users', label: 'Pengguna', icon: Users, permission: 'users.read' },
  { href: '/master/access-tiers', label: 'Paket akses', icon: Courses, permission: 'commerce.manage' },
  { href: '/master/forum', label: 'Forum', icon: Users, permission: 'discussions.moderate' },
  { href: '/master/insights', label: 'Insight', icon: Dashboard, permission: 'analytics.read' },
  {
    href: '/master/live-sessions',
    label: 'Sesi langsung',
    icon: Courses,
    permission: 'courses.manage',
  },
] as const;

/** Kerangka halaman untuk area yang membutuhkan autentikasi. */
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  if (user.role === 'MASTER') {
    return (
      <div className="masterShell">
        <aside className="masterSidebar">
          <Link href="/master" className="workspaceSwitch" aria-label="Dashboard AIPreneur">
            <span className="brandMark">AI</span>
            <span>
              <strong>AIPreneur</strong>
              <small>Academy</small>
            </span>
          </Link>

          <nav className="sideNav" aria-label="Navigasi Master">
            <span className="sideLabel">Kelola</span>
            {MASTER_NAV.filter((item) => can(user, item.permission)).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.href} href={item.href}>
                  <span className="sideIcon"><Icon size={18} /></span>
                  {item.label}
                </NavLink>
              );
            })}
            <span className="sideLabel sideLabelSpace">Lihat akademi</span>
            <Link className="navLink" href="/courses">
              <span className="sideIcon"><ExternalLink size={18} /></span>
              Katalog Pelajar
            </Link>
          </nav>

          <div className="sideProfile">
            <Link href="/profile" className="sideProfileLink" aria-label="Buka profil">
              <UserAvatar user={user} />
              <span className="sideProfileText">
                <strong>{user.fullName}</strong>
                <small>Master</small>
              </span>
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </aside>
        <div className="masterMain">
          <header className="masterTopbar">
            <span className="mobileBrand">AIPreneur Academy</span>
            <span className="masterTopTitle">Workspace Master</span>
          </header>
          {children}
        </div>
      </div>
    );
  }

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
          <Link href="/profile" className="avatar" title={`Profil ${user.fullName}`}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              <span aria-hidden="true">{initials(user.fullName)}</span>
            )}
            <span className="srOnly">
              Buka profil {user.fullName}, peran {user.role}
            </span>
          </Link>
        </div>
      </header>
      {children}
    </>
  );
}

function UserAvatar({ user }: { user: CurrentUser }) {
  return (
    <span className="avatar">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" />
      ) : (
        <span aria-hidden="true">{initials(user.fullName)}</span>
      )}
    </span>
  );
}
