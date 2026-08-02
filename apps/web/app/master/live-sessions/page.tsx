import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrapList } from '../../lib/api';
import { requirePermission } from '../../lib/session';
import { LiveSessionManager } from './live-session-manager';

export const metadata: Metadata = { title: 'Sesi langsung · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function LiveSessionsPage() {
  const user = await requirePermission('courses.manage', '/master/live-sessions');
  const client = await serverClient();
  const { items: courses } = unwrapList<Schemas['AdminCourseListItemDto']>(
    await client.GET('/api/v1/admin/courses', { params: { query: { page: 1, pageSize: 100 } } }),
  );

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Kelas langsung</span>
            <h1 className="pageTitle">Sesi langsung</h1>
            <p className="pageSub">
              Jadwalkan pertemuan Zoom atau Google Meet, lalu tempel tautannya. Peserta kursus
              melihat jadwalnya dan tombol gabung terbuka 15 menit sebelum mulai.
            </p>
          </div>
        </div>
        <LiveSessionManager courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
      </main>
    </AppShell>
  );
}
