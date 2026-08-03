import Link from 'next/link';

export type CommunityEvent = { id: string; title: string; startsAt: string; status: string; joinUrl?: string | null };
export type CommunityAnnouncement = { id: string; title: string; body: string; publishedAt?: string | null };

export function CommunityRail({ events, announcements }: { events: CommunityEvent[]; announcements: CommunityAnnouncement[] }) {
  return <aside className="communityRail">
    <section className="railCard card"><div className="railTitle"><h2>Event mendatang</h2><span>{events.length}</span></div>{events.length ? events.slice(0, 5).map((event) => <article className="eventItem" key={event.id}><time><strong>{new Date(event.startsAt).getDate()}</strong><span>{new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(event.startsAt))}</span></time><div><strong>{event.title}</strong><small>{new Intl.DateTimeFormat('id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(event.startsAt))} WIB</small>{event.joinUrl ? <a href={event.joinUrl} target="_blank" rel="noreferrer">Gabung</a> : null}</div></article>) : <p className="communityMuted">Belum ada event terjadwal.</p>}</section>
    <section className="railCard card"><div className="railTitle"><h2>Pengumuman terbaru</h2><Link href="/announcements">Lihat semua</Link></div>{announcements.length ? announcements.slice(0, 4).map((item) => <Link className="announcementItem" href="/announcements" key={item.id}><strong>{item.title}</strong><span>{item.body}</span></Link>) : <p className="communityMuted">Belum ada pengumuman.</p>}</section>
  </aside>;
}
