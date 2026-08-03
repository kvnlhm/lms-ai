import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { serverClient, unwrap } from '../lib/api';
import { requireUser } from '../lib/session';
import { BookmarkList } from './bookmark-list';

export const metadata: Metadata = { title: 'Materi ditandai · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type Bookmark = Schemas['BookmarkDto'];

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
              Materi yang kamu tandai untuk dibuka lagi. Menandai tidak memengaruhi progres, dan
              catatan yang kamu tulis di sini tidak pernah terlihat pengguna lain.
            </p>
          </div>
        </div>

        {bookmarks.length === 0 ? (
          <div className="card emptyCard">
            <p className="emptyCardTitle">Belum ada materi yang ditandai.</p>
            <p className="muted emptyCardNote">
              Buka sebuah materi lalu tekan &ldquo;Tandai materi&rdquo; untuk menyimpannya di sini.
            </p>
          </div>
        ) : (
          <BookmarkList bookmarks={bookmarks} />
        )}
      </main>
    </AppShell>
  );
}
