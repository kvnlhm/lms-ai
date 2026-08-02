import type { Metadata } from 'next';
import { AppShell } from '../components/app-shell';
import { requireUser } from '../lib/session';
import { AnnouncementFeed } from './announcement-feed';

export const metadata: Metadata = { title: 'Pengumuman · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const user = await requireUser('/announcements');

  return (
    <AppShell user={user}>
      <main className={user.role === 'MASTER' ? 'masterContent' : 'wrap wrapNarrow'}>
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Kabar akademi</span>
            <h1 className="pageTitle">Pengumuman</h1>
            <p className="pageSub">Kabar penting dari Master yang berlaku untukmu.</p>
          </div>
        </div>
        <AnnouncementFeed />
      </main>
    </AppShell>
  );
}
