import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrapList } from '../../lib/api';
import { requirePermission } from '../../lib/session';
import { AnnouncementManager } from './announcement-manager';

export const metadata: Metadata = { title: 'Pengumuman · AIPreneur Academy' };
export const dynamic = 'force-dynamic';

export default async function MasterAnnouncementsPage() {
  const user = await requirePermission('announcements.manage', '/master/announcements');
  const client = await serverClient();
  const { items: courses } = unwrapList<Schemas['AdminCourseListItemDto']>(
    await client.GET('/api/v1/admin/courses', { params: { query: { page: 1, pageSize: 100 } } }),
  );

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Kabar akademi</span>
            <h1 className="pageTitle">Pengumuman</h1>
            <p className="pageSub">
              Tulis sebagai draft, terbitkan saat siap. Pelajar hanya menerima yang relevan
              untuknya.
            </p>
          </div>
        </div>
        <AnnouncementManager courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
      </main>
    </AppShell>
  );
}
