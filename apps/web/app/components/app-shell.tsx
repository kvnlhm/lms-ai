import type { ReactNode } from 'react';
import Link from 'next/link';
import type { CurrentUser } from '../lib/session';
import { can, initials } from '../lib/session';
import { Bell, Courses, Dashboard, ExternalLink, Users } from './icons';
import { LogoutButton } from './logout-button';
import { MasterMobileNav } from './master-mobile-nav';
import { NavLink } from './nav-link';
import { ThemeToggle } from './theme-toggle';
import { ImpersonationBanner } from './impersonation-banner';
import { GlobalSearch } from './global-search';
import { MobileNavigation } from './mobile-navigation';

const LEARNER_NAV = [
  { href: '/', label: 'Beranda' },
  { href: '/courses', label: 'Kursus' },
  { href: '/history', label: 'Histori' },
  { href: '/bookmarks', label: 'Ditandai' },
  { href: '/announcements', label: 'Pengumuman' },
  { href: '/notifications', label: 'Notifikasi' },
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
  {
    href: '/master/announcements',
    label: 'Pengumuman',
    icon: Dashboard,
    permission: 'announcements.manage',
  },
  { href: '/master/media', label: 'Perpustakaan video', icon: Courses, permission: 'courses.manage' },
  { href: '/master/reports', label: 'Laporan', icon: Dashboard, permission: 'reports.export' },
  { href: '/master/errors', label: 'Galat', icon: Dashboard, permission: 'audit.read' },
  { href: '/master/audit', label: 'Audit log', icon: Users, permission: 'audit.read' },
] as const;

/** Kerangka halaman untuk area yang membutuhkan autentikasi. */
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  if (user.role === 'MASTER') {
    // Bilah bawah hanya memuat tiga tujuan teratas yang boleh diakses; label di
    // bawah ikon menjadi tidak terbaca bila diisi lebih banyak. Sisanya masuk
    // lembar "Lainnya", jadi tidak ada tujuan yang hilang.
    // Ikonnya dirender di sini, bukan diteruskan sebagai komponen: berkas ini
    // server component sedangkan MasterMobileNav client component, dan fungsi
    // tidak dapat menyeberangi batas keduanya.
    const izinkan = MASTER_NAV.filter((item) => can(user, item.permission));
    const utama = izinkan.slice(0, 3).map(({ href, label, icon: Icon }) => ({
      href,
      label,
      icon: <Icon size={21} />,
    }));
    const lainnya = [
      ...izinkan.slice(3).map(({ href, label, icon: Icon }) => ({
        href,
        label,
        icon: <Icon size={19} />,
      })),
      { href: '/notifications', label: 'Notifikasi', icon: <Bell size={19} /> },
      { href: '/courses', label: 'Katalog Pelajar', icon: <ExternalLink size={19} /> },
    ];

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
            {/* Tanpa permission: Master juga menerima notifikasi diskusi baru
                dan konten yang dilaporkan. */}
            <NavLink href="/notifications">
              <span className="sideIcon"><Dashboard size={18} /></span>
              Notifikasi
            </NavLink>
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
            <MobileNavigation title="Menu Master">
              <nav className="mobileDrawerNav" aria-label="Navigasi Master mobile">
                {MASTER_NAV.filter((item) => can(user, item.permission)).map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={`drawer-${item.href}`} href={item.href}>
                      <span className="sideIcon"><Icon size={18} /></span>
                      {item.label}
                    </NavLink>
                  );
                })}
                <NavLink href="/notifications">
                  <span className="sideIcon"><Dashboard size={18} /></span>
                  Notifikasi
                </NavLink>
                <Link className="navLink" href="/courses">
                  <span className="sideIcon"><ExternalLink size={18} /></span>
                  Katalog Pelajar
                </Link>
                <Link className="navLink" href="/profile">
                  <UserAvatar user={user} />
                  Profil
                </Link>
              </nav>
              <div className="mobileDrawerActions">
                <ThemeToggle />
                <LogoutButton />
              </div>
            </MobileNavigation>
            <span className="mobileBrand">Academy AIPreneur</span>
            <span className="masterTopTitle">Workspace Master</span>
            <GlobalSearch />
          </header>
          {children}
        </div>

        <MasterMobileNav
          primary={utama}
          secondary={lainnya}
          sheetHeader={
            <>
              <UserAvatar user={user} />
              <span className="masterSheetIdentity">
                <strong>{user.fullName}</strong>
                <small>{user.email}</small>
              </span>
            </>
          }
          sheetFooter={
            <>
              <Link href="/profile" className="masterSheetRow">
                <UserAvatar user={user} />
                <span>Profil</span>
              </Link>
              <div className="masterSheetTools">
                <ThemeToggle />
                <LogoutButton />
              </div>
            </>
          }
        />
      </div>
    );
  }

  return (
    <>
      {user.isImpersonating ? <ImpersonationBanner /> : null}
      <header className="topbar">
        <MobileNavigation title="Academy AIPreneur">
          <nav className="mobileDrawerNav" aria-label="Navigasi Pelajar mobile">
            {[
              ...LEARNER_NAV,
              ...MASTER_NAV.filter((item) => can(user, item.permission)),
            ].map((item) => (
              <NavLink key={`drawer-${item.href}`} href={item.href}>
                {item.label}
              </NavLink>
            ))}
            <Link className="navLink" href="/profile">
              <UserAvatar user={user} />
              Profil
            </Link>
          </nav>
          <div className="mobileDrawerActions">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </MobileNavigation>
        <Link href="/" className="brand" aria-label="Academy AIPreneur, ke beranda">
          <span className="brandMark" aria-hidden="true">
            AO
          </span>
          <span>AIPreneur</span>
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
          <GlobalSearch />
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
