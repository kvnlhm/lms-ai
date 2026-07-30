import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { requirePermission } from '../../lib/session';
import { ForumModeration } from './forum-moderation';

export const metadata: Metadata = { title: 'Forum · AIPreneur Academy' };
export const dynamic = 'force-dynamic';

export default async function MasterForumPage() {
  const user = await requirePermission('discussions.moderate', '/master/forum');

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Komunitas</span>
            <h1 className="pageTitle">Forum diskusi</h1>
            <p className="pageSub">
              Tinjau diskusi, tangani laporan pelajar, dan atur siapa yang boleh menulis.
            </p>
          </div>
        </div>
        <ForumModeration />
      </main>
    </AppShell>
  );
}
