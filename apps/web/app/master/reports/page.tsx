import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrapList } from '../../lib/api';
import { requirePermission } from '../../lib/session';
import { ReportExporter } from './report-exporter';

export const metadata: Metadata = { title: 'Laporan · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function MasterReportsPage() {
  const user = await requirePermission('reports.export', '/master/reports');
  const client = await serverClient();
  const { items: courses } = unwrapList<Schemas['AdminCourseListItemDto']>(
    await client.GET('/api/v1/admin/courses', { params: { query: { page: 1, pageSize: 100 } } }),
  );

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Ekspor data</span>
            <h1 className="pageTitle">Laporan</h1>
            <p className="pageSub">
              Unduh sebagai CSV. Penyaring di bawah berlaku untuk laporan yang relevan, dan setiap
              unduhan tercatat pada audit log.
            </p>
          </div>
        </div>
        <ReportExporter courses={courses.map((course) => ({ id: course.id, title: course.title }))} />
      </main>
    </AppShell>
  );
}
