import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { requirePermission } from '../../lib/session';
import { AuditLogBrowser } from './audit-log-browser';

export const metadata: Metadata = { title: 'Audit log · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function MasterAuditPage() {
  const user = await requirePermission('audit.read', '/master/audit');

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Jejak tindakan</span>
            <h1 className="pageTitle">Audit log</h1>
            <p className="pageSub">
              Siapa mengubah apa, kapan, dan dari mana. Catatan ini tidak dapat diubah maupun
              dihapus dari sini.
            </p>
          </div>
        </div>
        <AuditLogBrowser />
      </main>
    </AppShell>
  );
}
