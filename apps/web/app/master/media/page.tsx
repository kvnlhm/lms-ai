import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { requirePermission } from '../../lib/session';
import { VideoLibrary } from './video-library';

export const metadata: Metadata = { title: 'Perpustakaan video · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function MasterMediaPage() {
  const user = await requirePermission('courses.manage', '/master/media');

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Materi tersimpan</span>
            <h1 className="pageTitle">Perpustakaan video</h1>
            <p className="pageSub">
              Semua video yang pernah diunggah, berapa besarnya, dan pelajaran mana yang memakainya.
              Satu berkas dapat dipakai banyak pelajaran tanpa diunggah ulang.
            </p>
          </div>
        </div>
        <VideoLibrary />
      </main>
    </AppShell>
  );
}
