import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { requirePermission } from '../../lib/session';
import { LiveSessionManager } from './live-session-manager';

export const metadata: Metadata = { title: 'Sesi langsung · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function LiveSessionsPage() {
  const user = await requirePermission('courses.manage', '/master/live-sessions');
  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Kelas langsung</span>
            <h1 className="pageTitle">Sesi langsung</h1>
            <p className="pageSub">
              Jadwalkan event umum dengan tautan Zoom atau Google Meet. Event dapat dilihat
              peserta dan tombol gabung terbuka 15 menit sebelum mulai.
            </p>
          </div>
        </div>
        <LiveSessionManager />
      </main>
    </AppShell>
  );
}
