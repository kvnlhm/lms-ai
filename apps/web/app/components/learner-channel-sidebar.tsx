'use client';

import { Fragment, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { browserClient, unwrap } from '../lib/browser-api';
import type { CommunityChannel, CommunityChannelType } from '../community/community-feed';
import { ClipboardList, Dashboard, FileText, Megaphone, MessageCircle } from './icons';

const MONITORING_SHORTCUT = { href: '/#monitoring-harian', label: 'Monitoring harian' } as const;

/**
 * Ikon garis per bentuk sub-channel.
 *
 * Sidebar memakai peta tersendiri, bukan glif teks `COMMUNITY_CHANNEL_TYPES`:
 * `#` dan `▤` diambil dari font yang berbeda-beda per sistem, sehingga tinggi
 * dan tebalnya tidak pernah sejajar dengan ikon Monitoring di atasnya. Glifnya
 * tetap dipakai di layar Master, tempat ia berdiri sebagai penanda tipe di
 * dalam teks, bukan sebagai ikon navigasi.
 */
const CHANNEL_ICONS: Record<CommunityChannelType, (props: { size?: number }) => ReactElement> = {
  CHAT: MessageCircle,
  POSTS: FileText,
  ANNOUNCEMENTS: Megaphone,
  CHECKLIST: ClipboardList,
};

/**
 * Pintasan ruang komunitas yang dipilih Master.
 *
 * Nama Channel menjadi label kelompok, bukan tombol accordion: daftar
 * pintasannya pendek, sehingga chevron dan keterangan di bawah tiap baris
 * hanya menambah berat visual tanpa menyembunyikan apa pun yang panjang.
 * Bentuknya mengikuti pintasan komunitas pada sidebar Master.
 */
export function LearnerChannelSidebar({ placement = 'desktop' }: { placement?: 'desktop' | 'drawer' }) {
  const pathname = usePathname();
  const [channels, setChannels] = useState<CommunityChannel[]>([]);

  useEffect(() => {
    let active = true;
    browserClient().GET('/api/v1/community/sidebar-channels', {})
      .then((result) => unwrap<CommunityChannel[]>(result))
      .then((items) => { if (active) setChannels(items); })
      .catch(() => { /* Navigasi utama tetap berfungsi bila pintasan gagal dimuat. */ });
    return () => { active = false; };
  }, []);

  return <aside className={`learnerChannelSidebar learnerChannelSidebar${placement === 'drawer' ? 'Drawer' : 'Desktop'}`} aria-label="Pintasan Pelajar">
    <span className="channelGroup learnerMenuLabel">Monitoring</span>
    <Link className={pathname === '/' ? 'channelLink active' : 'channelLink'} href={MONITORING_SHORTCUT.href}><span className="channelIcon"><Dashboard size={16} /></span><strong>{MONITORING_SHORTCUT.label}</strong></Link>
    {channels.map((channel) => <Fragment key={channel.id}>
      <span className="channelGroup">{channel.name}</span>
      {channel.subchannels.map((sub) => { const Icon = CHANNEL_ICONS[sub.type]; return <Link key={sub.id} className={pathname === `/community/${channel.slug}/${sub.slug}` ? 'channelLink active' : 'channelLink'} href={`/community/${channel.slug}/${sub.slug}`}><span className="channelIcon"><Icon size={16} /></span><strong>{sub.name}</strong></Link>; })}
    </Fragment>)}
    {channels.length === 0 ? <p className="communityMuted">Belum ada channel yang dipilih Master.</p> : null}
  </aside>;
}
