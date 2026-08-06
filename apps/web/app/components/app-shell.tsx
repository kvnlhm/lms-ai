import type { ReactNode } from 'react';
import Link from 'next/link';
import { serverClient, unwrap } from '../lib/api';
import type { CurrentUser } from '../lib/session';
import { can, initials } from '../lib/session';
import { BrandMark } from './brand-mark';
import { AlertTriangle, BarChart, Bell, Calendar, ClipboardList, Courses, CreditCard, Dashboard, ExternalLink, FileText, Hash, Megaphone, MessageCircle, Package, Users, Video } from './icons';
import { LogoutButton } from './logout-button';
import { MasterMobileNav } from './master-mobile-nav';
import { NavLink } from './nav-link';
import { ThemeToggle } from './theme-toggle';
import { ImpersonationBanner } from './impersonation-banner';
import { GlobalSearch } from './global-search';
import { MobileNavigation } from './mobile-navigation';
import { LearnerChannelSidebar } from './learner-channel-sidebar';
import { LearnerMobileNav } from './learner-mobile-nav';
import { MasterCommunityShortcuts } from './master-community-shortcuts';

const LEARNER_NAV = [
  { href: '/community', label: 'Komunitas' },
  { href: '/courses', label: 'Kursus' },
  { href: '/announcements', label: 'Pengumuman' },
  { href: '/notifications', label: 'Notifikasi' },
];

const MASTER_NAV = [
  { href: '/master', label: 'Dashboard', icon: Dashboard, permission: 'courses.manage' },
  { href: '/master/courses', label: 'Kursus', icon: Courses, permission: 'courses.manage' },
  { href: '/master/users', label: 'Pengguna', icon: Users, permission: 'users.read' },
  { href: '/master/access-tiers', label: 'Paket akses', icon: Package, permission: 'commerce.manage' },
  { href: '/master/transactions', label: 'Transaksi', icon: CreditCard, permission: 'commerce.manage' },
  { href: '/master/forum', label: 'Forum', icon: MessageCircle, permission: 'discussions.moderate' },
  { href: '/master/community', label: 'Channel komunitas', icon: Hash, permission: 'discussions.moderate' },
  { href: '/master/insights', label: 'Insight', icon: BarChart, permission: 'analytics.read' },
  {
    href: '/master/live-sessions',
    label: 'Sesi langsung',
    icon: Calendar,
    permission: 'courses.manage',
  },
  {
    href: '/master/announcements',
    label: 'Pengumuman',
    icon: Megaphone,
    permission: 'announcements.manage',
  },
  { href: '/master/media', label: 'Perpustakaan video', icon: Video, permission: 'courses.manage' },
  { href: '/master/reports', label: 'Laporan', icon: FileText, permission: 'reports.export' },
  { href: '/master/errors', label: 'Galat', icon: AlertTriangle, permission: 'audit.read' },
  { href: '/master/audit', label: 'Audit log', icon: ClipboardList, permission: 'audit.read' },
] as const;

/**
 * Jumlah pengumuman yang belum dibaca.
 *
 * Diambil di server, sekali per render halaman: navigasi desktop dan laci
 * mobile digambar bersamaan, jadi mengambilnya dari peramban berarti dua
 * permintaan untuk satu angka. Kegagalannya berarti nol — lencana yang hilang
 * jauh lebih baik daripada bilah navigasi yang gagal digambar.
 */
async function hitungPengumumanBelumDibaca(): Promise<number> {
  try {
    const client = await serverClient();
    const hasil = unwrap<{ unread: number }>(
      await client.GET('/api/v1/me/announcements/unread-count', {}),
    );
    return hasil.unread;
  } catch {
    return 0;
  }
}

async function hitungNotifikasiBelumDibaca(): Promise<number> {
  try {
    const client = await serverClient();
    const hasil = unwrap<{ unread: number }>(
      await client.GET('/api/v1/me/notifications/unread-count', {}),
    );
    return hasil.unread;
  } catch {
    return 0;
  }
}

/** Angka kecil di samping label navigasi; tidak digambar saat tidak ada. */
function LencanaBelumDibaca({ jumlah }: { jumlah: number }) {
  if (jumlah <= 0) return null;
  return (
    <span className="navBadge" aria-label={`${jumlah} pengumuman belum dibaca`}>
      {jumlah > 9 ? '9+' : jumlah}
    </span>
  );
}

/** Kerangka halaman untuk area yang membutuhkan autentikasi. */
export async function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
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
            <BrandMark />
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
              <span className="sideIcon"><Bell size={18} /></span>
              Notifikasi
            </NavLink>
            <span className="sideLabel sideLabelSpace">Lihat akademi</span>
            <Link className="navLink" href="/courses">
              <span className="sideIcon"><ExternalLink size={18} /></span>
              Katalog Pelajar
            </Link>
            <MasterCommunityShortcuts userId={user.id} />
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
                  <span className="sideIcon"><Bell size={18} /></span>
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

  // Diambil hanya di jalur Pelajar: navigasi Master tidak memuat "Pengumuman"
  // milik pelajar, jadi menghitungnya di sana hanya permintaan yang terbuang.
  const [pengumumanBelumDibaca, notifikasiBelumDibaca] = await Promise.all([
    hitungPengumumanBelumDibaca(),
    hitungNotifikasiBelumDibaca(),
  ]);

  return (
    <>
      {user.isImpersonating ? <ImpersonationBanner /> : null}
      <header className="topbar">
        <MobileNavigation title="Academy AIPreneur" variant="learner">
          <LearnerChannelSidebar placement="drawer" />
          {MASTER_NAV.some((item) => can(user, item.permission)) ? <nav className="mobileDrawerNav learnerDrawerMasterLinks" aria-label="Workspace Master">{MASTER_NAV.filter((item) => can(user, item.permission)).map((item) => <NavLink key={`drawer-${item.href}`} href={item.href}>{item.label}</NavLink>)}</nav> : null}
          <div className="mobileDrawerActions">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </MobileNavigation>
        <Link href="/" className="brand" aria-label="Academy AIPreneur, ke beranda">
          <BrandMark />
          <span>AIPreneur</span>
        </Link>

        <nav className="mainNav" aria-label="Navigasi utama">
          {[
            ...LEARNER_NAV,
            ...MASTER_NAV.filter((item) => can(user, item.permission)),
          ].map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
              {item.href === '/announcements' ? (
                <LencanaBelumDibaca jumlah={pengumumanBelumDibaca} />
              ) : null}
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
      <nav className="learnerMobileTabs" aria-label="Menu Pelajar">
        {LEARNER_NAV.map((item) => (
          <NavLink key={`mobile-tab-${item.href}`} href={item.href}>
            {item.label}
            {item.href === '/announcements' ? (
              <LencanaBelumDibaca jumlah={pengumumanBelumDibaca} />
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="learnerShellBody">
        <LearnerChannelSidebar placement="desktop" />
        <div className="learnerShellContent">{children}</div>
      </div>
      <LearnerMobileNav unread={notifikasiBelumDibaca} />
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
