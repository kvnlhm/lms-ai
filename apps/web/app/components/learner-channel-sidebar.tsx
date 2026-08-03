'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { browserClient, unwrap } from '../lib/browser-api';
import type { CommunityChannel } from '../community/community-feed';

/** Navigasi ruang komunitas yang tetap tersedia pada seluruh area Pelajar. */
export function LearnerChannelSidebar() {
  const pathname = usePathname();
  const [channels, setChannels] = useState<CommunityChannel[]>([]);

  useEffect(() => {
    let active = true;
    browserClient().GET('/api/v1/community/channels', {})
      .then((result) => unwrap<CommunityChannel[]>(result))
      .then((items) => { if (active) setChannels(items); })
      .catch(() => { /* Halaman utama tetap dapat dipakai bila komunitas sementara gagal dimuat. */ });
    return () => { active = false; };
  }, []);

  return <aside className="learnerChannelSidebar" aria-label="Ruang komunitas">
    <Link className={pathname === '/community' ? 'channelLink active' : 'channelLink'} href="/community"><span>▤</span><span><strong>Feed komunitas</strong><small>Post dan kabar terbaru</small></span></Link>
    <span className="channelGroup">Ruang komunitas</span>
    {channels.map((channel) => <Link key={channel.id} className={pathname === `/community/${channel.slug}` ? 'channelLink active' : 'channelLink'} href={`/community/${channel.slug}`}>
      <span>#</span><span><strong>{channel.name}</strong><small>{channel.description ?? `${channel.postCount} post`}</small></span>
    </Link>)}
    {channels.length === 0 ? <p className="communityMuted">Belum ada channel.</p> : null}
  </aside>;
}
