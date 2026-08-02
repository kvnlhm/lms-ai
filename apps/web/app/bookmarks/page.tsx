import type { Metadata } from 'next';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { serverClient, unwrap } from '../lib/api';
import { requireUser } from '../lib/session';

export const metadata: Metadata = { title: 'Materi ditandai · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type Bookmark = Schemas['BookmarkDto'];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

export default async function BookmarksPage() {
  const user = await requireUser('/bookmarks');
  const client = await serverClient();
  const bookmarks = unwrap<Bookmark[]>(await client.GET('/api/v1/me/bookmarks', {}));

  return (
    <AppShell user={user}>
      <main className={user.role === 'MASTER' ? 'masterContent' : 'wrap wrapNarrow'}>
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Simpanan</span>
            <h1 className="pageTitle">Materi ditandai</h1>
            <p className="pageSub">
              Materi yang kamu tandai untuk dibuka lagi. Menandai tidak memengaruhi progres.
            </p>
          </div>
        </div>

        {bookmarks.length === 0 ? (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Belum ada materi yang ditandai.</p>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Buka sebuah materi lalu tekan &ldquo;Tandai materi&rdquo; untuk menyimpannya di sini.
            </p>
          </div>
        ) : (
          <ul className="bookmarkList">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.lessonId} className="card bookmarkItem">
                <div>
                  <Link
                    className="bookmarkTitle"
                    href={`/learn/${bookmark.courseId}/${bookmark.lessonId}`}
                  >
                    {bookmark.lessonTitle}
                  </Link>
                  <p className="bookmarkMeta">
                    {bookmark.courseTitle} · {bookmark.moduleTitle}
                  </p>
                  {bookmark.note ? <p className="bookmarkNote">{bookmark.note}</p> : null}
                </div>
                <small className="muted">{formatDate(bookmark.createdAt)}</small>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
