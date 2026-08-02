import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { ambilSemuaKursus } from '../../lib/all-courses';
import { requirePermission } from '../../lib/session';
import { ReportExporter } from './report-exporter';

export const metadata: Metadata = { title: 'Laporan · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function MasterReportsPage() {
  const user = await requirePermission('reports.export', '/master/reports');
  // Kursus di sini mengisi penyaring; yang tidak termuat menjadi kursus yang
  // tidak dapat dilaporkan.
  const { courses } = await ambilSemuaKursus();

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
