import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { serverClient, unwrap } from '../lib/api';
import { requireUser } from '../lib/session';

export const dynamic = 'force-dynamic';

type HistoryPage = Schemas['LearningHistoryPageDto'];

export default async function HistoryPageView({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requireUser('/history');
  const { cursor } = await searchParams;
  const client = await serverClient();
  const history = unwrap<HistoryPage>(
    await client.GET('/api/v1/me/learning-history', {
      params: { query: { limit: 20, cursor } },
    }),
  );

  return (
    <AppShell user={user}>
      <main className="wrap historyPage">
        <div className="pageHead">
          <div className="pageHeadMain">
            <p className="eyebrow">Pembelajaran saya</p>
            <h1 className="pageTitle">Histori belajar</h1>
            <p className="pageSub">Aktivitas membuka dan menyelesaikan pelajaran.</p>
          </div>
        </div>

        {history.items.length === 0 ? (
          <div className="card empty">
            <p style={{ margin: 0 }}>Belum ada aktivitas belajar pada halaman ini.</p>
          </div>
        ) : (
          <div className="card historyList">
            {history.items.map((item) => (
              <article key={item.id} className="historyItem">
                <span className={`historyDot ${item.activityType === 'LESSON_COMPLETED' ? 'complete' : ''}`} />
                <div>
                  <span className="eyebrow">
                    {item.activityType === 'LESSON_COMPLETED' ? 'Pelajaran selesai' : 'Pelajaran dibuka'}
                  </span>
                  <h2>{item.lessonTitle}</h2>
                  <p>{item.courseTitle}{item.moduleTitle ? ` · ${item.moduleTitle}` : ''}</p>
                  <time dateTime={item.occurredAt}>
                    {new Intl.DateTimeFormat('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Jakarta',
                    }).format(new Date(item.occurredAt))}
                  </time>
                </div>
                {item.lessonId && item.courseId ? (
                  <Link className="btnTiny" href={`/learn/${item.courseId}/${item.lessonId}`}>Buka</Link>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {history.nextCursor ? (
          <div className="historyPagination">
            <Link className="btnSecondary" href={`/history?cursor=${encodeURIComponent(history.nextCursor)}`}>
              Aktivitas sebelumnya
            </Link>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
