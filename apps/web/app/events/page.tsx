import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { serverClient, unwrap } from '../lib/api';
import { requireUser } from '../lib/session';

export const metadata: Metadata = { title: 'Event · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type Enrollment = Schemas['MyEnrollmentDto'];
type LiveSession = { id: string; title: string; description?: string | null; startsAt: string; durationMinutes: number; status: string; joinUrl?: string | null };

export default async function EventsPage() {
  const user = await requireUser('/events');
  const client = await serverClient();
  const enrollments = unwrap<Enrollment[]>(await client.GET('/api/v1/me/enrollments', {}));
  const groups = await Promise.all(enrollments.map(async (item) => {
    try {
      const sessions = unwrap<LiveSession[]>(await client.GET('/api/v1/learn/courses/{courseId}/live-sessions', { params: { path: { courseId: item.course.id } } }));
      return sessions.filter((session) => session.status !== 'ENDED').map((session) => ({ ...session, courseId: item.course.id, courseTitle: item.course.title }));
    } catch { return []; }
  }));
  const events = groups.flat().sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  return <AppShell user={user}><main className="wrap wrapNarrow learnerIndexPage">
    <div className="pageHead"><div className="pageHeadMain"><span className="eyebrow">Agenda belajar</span><h1 className="pageTitle">Event</h1><p className="pageSub">Sesi langsung dari seluruh kursus yang kamu ikuti.</p></div></div>
    {events.length === 0 ? <div className="card emptyCard"><p className="emptyCardTitle">Belum ada event yang dijadwalkan.</p><Link className="btnTiny" href="/courses">Buka kursus</Link></div> : <div className="learnerIndexList">{events.map((event) => <article className="card learnerEventRow" key={event.id}><time dateTime={event.startsAt}><strong>{new Intl.DateTimeFormat('id-ID', { day: '2-digit' }).format(new Date(event.startsAt))}</strong><span>{new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(event.startsAt))}</span></time><div><span className="eyebrow">{event.courseTitle}</span><strong>{event.title}</strong><small>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(event.startsAt))} · {event.durationMinutes} menit</small>{event.description ? <p>{event.description}</p> : null}</div><div>{event.status === 'LIVE' && event.joinUrl ? <a className="btn" href={event.joinUrl} target="_blank" rel="noopener noreferrer">Gabung</a> : <Link className="btn secondary" href={`/courses/${event.courseId}`}>Lihat kursus</Link>}</div></article>)}</div>}
  </main></AppShell>;
}
