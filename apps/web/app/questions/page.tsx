import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { MessageCircle } from '../components/icons';
import { serverClient, unwrap } from '../lib/api';
import { requireUser } from '../lib/session';

export const metadata: Metadata = { title: 'Tanya Jawab · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type Enrollment = Schemas['MyEnrollmentDto'];

export default async function QuestionsPage() {
  const user = await requireUser('/questions');
  const client = await serverClient();
  const enrollments = unwrap<Enrollment[]>(await client.GET('/api/v1/me/enrollments', {}));

  return <AppShell user={user}><main className="wrap wrapNarrow learnerIndexPage">
    <div className="pageHead"><div className="pageHeadMain"><span className="eyebrow">Belajar bersama</span><h1 className="pageTitle">Tanya jawab</h1><p className="pageSub">Pilih kursus untuk bertanya, berdiskusi, atau membantu pelajar lain.</p></div></div>
    {enrollments.length === 0 ? <div className="card emptyCard"><p className="emptyCardTitle">Belum ada forum yang dapat dibuka.</p><Link className="btnTiny" href="/courses">Lihat kursus</Link></div> : <div className="learnerIndexList">{enrollments.map((item) => <Link className="card learnerIndexRow" href={`/learn/${item.course.id}/forum`} key={item.enrollmentId}><span className="learnerIndexIcon"><MessageCircle size={20} /></span><span><strong>{item.course.title}</strong><small>Buka forum tanya jawab kursus</small></span><span aria-hidden="true">›</span></Link>)}</div>}
  </main></AppShell>;
}
