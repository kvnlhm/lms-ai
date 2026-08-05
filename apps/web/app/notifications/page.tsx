import type { Metadata } from 'next';
import { AppShell } from '../components/app-shell';
import { requireUser } from '../lib/session';
import { NotificationInbox } from './notification-inbox';

export const metadata: Metadata = { title: 'Notifikasi · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser('/notifications');

  return (
    <AppShell user={user}>
      <main className={user.role === 'MASTER' ? 'masterContent' : 'wrap wrapNarrow learnerNotificationPage'}>
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Pemberitahuan</span>
            <h1 className="pageTitle">Notifikasi</h1>
            <p className="pageSub">Kabar terbaru tentang diskusi, kursus, dan sesi langsungmu.</p>
          </div>
        </div>
        <NotificationInbox />
      </main>
    </AppShell>
  );
}
