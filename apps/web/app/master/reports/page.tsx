import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrapList } from '../../lib/api';
import { requirePermission } from '../../lib/session';
import { ReportExporter } from './report-exporter';

export const metadata: Metadata = { title: 'Laporan · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

/** Batas satu permintaan pada API, dan batas pengaman rantai permintaannya. */
const UKURAN_HALAMAN = 100;
const MAKS_HALAMAN = 10;

export default async function MasterReportsPage() {
  const user = await requirePermission('reports.export', '/master/reports');
  const client = await serverClient();
  // Daftar kursus di sini mengisi penyaring, jadi kursus yang tidak termuat
  // menjadi kursus yang tidak dapat dilaporkan. Sebelumnya hanya halaman
  // pertama yang diambil: pada katalog di atas seratus kursus, sebagian
  // sederhananya hilang dari pilihan tanpa satu pun tanda.
  const pertama = unwrapList<Schemas['AdminCourseListItemDto']>(
    await client.GET('/api/v1/admin/courses', {
      params: { query: { page: 1, pageSize: UKURAN_HALAMAN } },
    }),
  );
  const courses = [...pertama.items];
  const halamanTerakhir = Math.min(pertama.meta.totalPages, MAKS_HALAMAN);
  for (let halaman = 2; halaman <= halamanTerakhir; halaman += 1) {
    const lanjutan = unwrapList<Schemas['AdminCourseListItemDto']>(
      await client.GET('/api/v1/admin/courses', {
        params: { query: { page: halaman, pageSize: UKURAN_HALAMAN } },
      }),
    );
    courses.push(...lanjutan.items);
  }

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
