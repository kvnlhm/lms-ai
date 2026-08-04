import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { serverClient, unwrap } from '../lib/api';
import { requireUser } from '../lib/session';
import { HistoryList } from './history-list';

export const metadata: Metadata = { title: 'Histori belajar · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type HistoryPage = Schemas['LearningHistoryPageDto'];

export default async function HistoryPageView() {
  const user = await requireUser('/history');
  const client = await serverClient();
  // Halaman pertama diambil di server agar riwayat langsung terbaca; sisanya
  // ditumpuk dari peramban. Kursor tidak lagi lewat URL — sebelumnya menekan
  // "Aktivitas sebelumnya" mengganti seluruh isi halaman tanpa jalan kembali.
  const history = unwrap<HistoryPage>(
    await client.GET('/api/v1/me/learning-history', { params: { query: { limit: 20 } } }),
  );

  return (
    <AppShell user={user}>
      <main className="wrap historyPage">
        <div className="pageHead">
          <div className="pageHeadMain">
            <p className="eyebrow">Pembelajaran saya</p>
            <h1 className="pageTitle">Histori belajar</h1>
            <p className="pageSub">Aktivitas membuka dan menyelesaikan pelajaran.</p>
          </div>
        </div>

        <HistoryList initial={history} />
      </main>
    </AppShell>
  );
}
