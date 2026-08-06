'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { browserClient, unwrap } from '../lib/browser-api';
import { COMMUNITY_CHANNEL_TYPES, type CommunityChannel } from '../community/community-feed';
import { Dashboard } from './icons';

const MONITORING_SHORTCUT = { href: '/#monitoring-harian', label: 'Monitoring harian', description: 'Ringkasan progres belajar' } as const;

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

  return <aside className={`learnerChannelSidebar learnerChannelSidebar${placement === 'drawer' ? 'Drawer' : 'Desktop'}`} aria-label="Pintasan Pelajar">
    <span className="channelGroup learnerMenuLabel">Monitoring</span>
    <Link className={pathname === '/' ? 'channelLink active' : 'channelLink'} href={MONITORING_SHORTCUT.href}><span><Dashboard size={20} /></span><span><strong>{MONITORING_SHORTCUT.label}</strong><small>{MONITORING_SHORTCUT.description}</small></span></Link>
    {channels.length > 0 ? <span className="channelGroup">Channel</span> : null}
    {channels.map((channel) => {
      const open = expanded.has(channel.id); const active = pathname.startsWith(`/community/${channel.slug}`);
      return <div className="learnerShortcutGroup" key={channel.id}><button type="button" className={active ? 'channelLink active' : 'channelLink'} aria-expanded={open} onClick={() => toggle(channel.id)}><span className="shortcutChevron">›</span><span><strong>{channel.name}</strong><small>{channel.subchannels.length} sub-channel</small></span></button>{open ? <div className="learnerShortcutChildren">{channel.subchannels.map((sub) => <Link key={sub.id} className={pathname === `/community/${channel.slug}/${sub.slug}` ? 'channelLink active' : 'channelLink'} href={`/community/${channel.slug}/${sub.slug}`}><span>{COMMUNITY_CHANNEL_TYPES[sub.type].icon}</span><span><strong>{sub.name}</strong><small>{sub.description ?? COMMUNITY_CHANNEL_TYPES[sub.type].label}</small></span></Link>)}</div> : null}</div>;
    })}
    {channels.length === 0 ? <p className="communityMuted">Belum ada channel yang dipilih Master.</p> : null}
  </aside>;
}
