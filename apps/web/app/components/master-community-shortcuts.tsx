'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient, unwrap } from '../lib/browser-api';
import { COMMUNITY_CHANNEL_TYPES, type CommunityChannel } from '../community/community-feed';

const INTERVAL_SEGARKAN = 30_000;

type Counts = Record<string, number>;

/**
 * Pintasan ruang komunitas untuk Master.
 *
 * API menjadi sumber jumlah pesan. Browser hanya menyimpan jumlah terakhir
 * yang sudah dilihat akun ini, sehingga badge berarti selisih sejak kunjungan
 * terakhir—bukan kewenangan atau status yang dipercaya server.
 */
export function MasterCommunityShortcuts({ userId }: { userId: string }) {
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [unread, setUnread] = useState<Counts>({});
  const baseline = useRef<Counts>({});
  const storageKey = `master-community-seen:${userId}`;

  useEffect(() => {
    try {
      baseline.current = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Counts;
    } catch {
      baseline.current = {};
    }

    let active = true;
    async function load() {
      try {
        const items = unwrap<CommunityChannel[]>(
          await browserClient().GET('/api/v1/community/sidebar-channels', {}),
        );
        if (!active) return;

        const firstVisit = Object.keys(baseline.current).length === 0;
        const nextUnread: Counts = {};
        const nextBaseline = { ...baseline.current };
        for (const group of items) {
          for (const sub of group.subchannels) {
            if (firstVisit || nextBaseline[sub.id] === undefined) nextBaseline[sub.id] = sub.postCount;
            nextUnread[sub.id] = Math.max(0, sub.postCount - (nextBaseline[sub.id] ?? sub.postCount));
          }
        }
        if (firstVisit) localStorage.setItem(storageKey, JSON.stringify(nextBaseline));
        baseline.current = nextBaseline;
        setChannels(items);
        setUnread(nextUnread);
        setExpanded((current) => {
          const next = new Set(current);
          for (const group of items) {
            if (group.subchannels.some((sub) => (nextUnread[sub.id] ?? 0) > 0)) next.add(group.id);
          }
          return next;
        });
      } catch {
        // Navigasi utama tetap tersedia ketika pintasan komunitas gagal dimuat.
      }
    }

    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, INTERVAL_SEGARKAN);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [storageKey]);

  function toggle(groupId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function markSeen(subchannelId: string, postCount: number) {
    const next = { ...baseline.current, [subchannelId]: postCount };
    baseline.current = next;
    localStorage.setItem(storageKey, JSON.stringify(next));
    setUnread((current) => ({ ...current, [subchannelId]: 0 }));
  }

  const totalUnread = Object.values(unread).reduce((total, count) => total + count, 0);
  if (channels.length === 0) return null;

  return (
    <div className="masterCommunityShortcuts">
      <span className="sideLabel masterCommunityLabel">
        Pesan komunitas
        {totalUnread > 0 ? <span className="navBadge" aria-label={`${totalUnread} pesan komunitas baru`}>{totalUnread > 99 ? '99+' : totalUnread}</span> : null}
      </span>
      {channels.map((group) => {
        const open = expanded.has(group.id);
        const groupUnread = group.subchannels.reduce((total, sub) => total + (unread[sub.id] ?? 0), 0);
        return (
          <div className="masterCommunityGroup" key={group.id}>
            <button type="button" className="masterCommunityToggle" aria-expanded={open} onClick={() => toggle(group.id)}>
              <span className="shortcutChevron">›</span>
              <span>{group.name}</span>
              {groupUnread > 0 ? <span className="navBadge">{groupUnread > 99 ? '99+' : groupUnread}</span> : null}
            </button>
            {open ? (
              <div className="masterCommunityRooms">
                {group.subchannels.map((sub) => {
                  const subUnread = unread[sub.id] ?? 0;
                  return (
                    <Link
                      href={`/community/${group.slug}/${sub.slug}`}
                      key={sub.id}
                      onClick={() => markSeen(sub.id, sub.postCount)}
                    >
                      <span className="masterCommunityHash">{COMMUNITY_CHANNEL_TYPES[sub.type].icon}</span>
                      <span>{sub.name}</span>
                      {subUnread > 0 ? <span className="navBadge">{subUnread > 99 ? '99+' : subUnread}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
