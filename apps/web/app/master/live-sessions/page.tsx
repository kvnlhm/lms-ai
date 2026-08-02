import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { requirePermission } from '../../lib/session';
import { LiveSessionManager } from './live-session-manager';
import { ambilSemuaKursus } from '../../lib/all-courses';

export const metadata: Metadata = { title: 'Sesi langsung · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function LiveSessionsPage() {
  const user = await requirePermission('courses.manage', '/master/live-sessions');
  // Kursus di sini mengisi penyaring; yang tidak termuat menjadi kursus yang
  // tidak dapat dipilih sama sekali.
  const { courses } = await ambilSemuaKursus();

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
