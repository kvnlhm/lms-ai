'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { browserClient, unwrap } from '../lib/browser-api';
import { COMMUNITY_CHANNEL_TYPES, type CommunityChannel } from '../community/community-feed';
import { Bell, Courses, Dashboard, Home, MessageCircle, Users } from './icons';

const LEARNER_SHORTCUT_GROUPS = [
  { label: 'Mulai', items: [
    { href: '/#monitoring-harian', activePath: '/', label: 'Monitoring harian', description: 'Ringkasan progres belajar', icon: Dashboard },
    { href: '/announcements', activePath: '/announcements', label: 'Pengumuman', description: 'Kabar penting akademi', icon: Bell },
  ] },
  { label: 'Materi utama', items: [
    { href: '/courses', activePath: '/courses', label: 'Kursus', description: 'Materi dan progres kamu', icon: Courses },
    { href: '/events', activePath: '/events', label: 'Event', description: 'Jadwal sesi langsung', icon: Users },
  ] },
  { label: 'Komunitas', items: [
    { href: '/community', activePath: '/community', label: 'Feed komunitas', description: 'Post dan percakapan terbaru', icon: Home },
    { href: '/questions', activePath: '/questions', label: 'Tanya jawab', description: 'Forum setiap kursus', icon: MessageCircle },
  ] },
  { label: 'Lainnya', items: [
    { href: '/notifications', activePath: '/notifications', label: 'Notifikasi', description: 'Aktivitas terbaru', icon: Bell },
    { href: '/profile', activePath: '/profile', label: 'Profil', description: 'Akun dan preferensi', icon: Users },
  ] },
] as const;

/** Pintasan ruang komunitas yang dipilih Master, dikelompokkan per Channel. */
export function LearnerChannelSidebar({ placement = 'desktop' }: { placement?: 'desktop' | 'drawer' }) {
  const pathname = usePathname();
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let active = true;
    browserClient().GET('/api/v1/community/sidebar-channels', {})
      .then((result) => unwrap<CommunityChannel[]>(result))
      .then((items) => {
        if (!active) return;
        setChannels(items);
        const current = items.find((item) => pathname.startsWith(`/community/${item.slug}`));
        if (current) setExpanded(new Set([current.id]));
      })
      .catch(() => { /* Navigasi utama tetap berfungsi bila pintasan gagal dimuat. */ });
    return () => { active = false; };
  }, [pathname]);

  function toggle(id: string) {
    setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function shortcut(item: (typeof LEARNER_SHORTCUT_GROUPS)[number]['items'][number]) {
    const Icon = item.icon;
    const active = item.activePath === '/' ? pathname === '/' : pathname.startsWith(item.activePath);
    return <Link key={item.href} className={active ? 'channelLink active' : 'channelLink'} href={item.href}><span><Icon size={20} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span></Link>;
  }

  return <aside className={`learnerChannelSidebar learnerChannelSidebar${placement === 'drawer' ? 'Drawer' : 'Desktop'}`} aria-label="Pintasan Pelajar">
    <span className="channelGroup learnerMenuLabel">{LEARNER_SHORTCUT_GROUPS[0].label}</span>
    {LEARNER_SHORTCUT_GROUPS[0].items.map(shortcut)}
    <span className="channelGroup">{LEARNER_SHORTCUT_GROUPS[1].label}</span>
    {LEARNER_SHORTCUT_GROUPS[1].items.map(shortcut)}
    <span className="channelGroup">{LEARNER_SHORTCUT_GROUPS[2].label}</span>
    {LEARNER_SHORTCUT_GROUPS[2].items.map(shortcut)}
    {channels.map((channel) => {
      const open = expanded.has(channel.id); const active = pathname.startsWith(`/community/${channel.slug}`);
      return <div className="learnerShortcutGroup" key={channel.id}><button type="button" className={active ? 'channelLink active' : 'channelLink'} aria-expanded={open} onClick={() => toggle(channel.id)}><span className="shortcutChevron">›</span><span><strong>{channel.name}</strong><small>{channel.subchannels.length} sub-channel</small></span></button>{open ? <div className="learnerShortcutChildren">{channel.subchannels.map((sub) => <Link key={sub.id} className={pathname === `/community/${channel.slug}/${sub.slug}` ? 'channelLink active' : 'channelLink'} href={`/community/${channel.slug}/${sub.slug}`}><span>{COMMUNITY_CHANNEL_TYPES[sub.type].icon}</span><span><strong>{sub.name}</strong><small>{sub.description ?? COMMUNITY_CHANNEL_TYPES[sub.type].label}</small></span></Link>)}</div> : null}</div>;
    })}
    {channels.length === 0 ? <p className="communityMuted">Belum ada channel yang dipilih Master.</p> : null}
    <span className="channelGroup">{LEARNER_SHORTCUT_GROUPS[3].label}</span>
    {LEARNER_SHORTCUT_GROUPS[3].items.map(shortcut)}
  </aside>;
}
