import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { requirePermission } from '../../lib/session';
import { ErrorMonitor } from './error-monitor';

export const metadata: Metadata = { title: 'Galat · AIPreneur Academy' };
export const dynamic = 'force-dynamic';

export default async function MasterErrorsPage() {
  const user = await requirePermission('audit.read', '/master/errors');

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Kesehatan sistem</span>
            <h1 className="pageTitle">Galat</h1>
            <p className="pageSub">
              Kegagalan yang benar-benar terjadi di API, browser pelajar, dan worker. Dikelompokkan
              per jenis, jadi satu bug tetap satu baris berapa kali pun ia terulang.
            </p>
          </div>
        </div>
        <ErrorMonitor />
      </main>
    </AppShell>
  );
}
