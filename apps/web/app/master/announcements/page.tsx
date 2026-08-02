import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { requirePermission } from '../../lib/session';
import { AnnouncementManager } from './announcement-manager';
import { ambilSemuaKursus } from '../../lib/all-courses';

export const metadata: Metadata = { title: 'Pengumuman · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function MasterAnnouncementsPage() {
  const user = await requirePermission('announcements.manage', '/master/announcements');
  // Kursus di sini mengisi penyaring; yang tidak termuat menjadi kursus yang
  // tidak dapat dipilih sama sekali.
  const { courses } = await ambilSemuaKursus();

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
