import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrap, unwrapList } from '../../lib/api';
import { requirePermission } from '../../lib/session';
import { AccessTierManager } from './tier-manager';

export const metadata: Metadata = { title: 'Paket Akses · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function AccessTiersPage() {
  const user = await requirePermission('commerce.manage', '/master/access-tiers');
  const client = await serverClient();
  const [tiersResponse, coursesResponse] = await Promise.all([
    client.GET('/api/v1/admin/access-tiers'),
    client.GET('/api/v1/admin/courses', { params: { query: { page: 1, pageSize: 100 } } }),
  ]);
  const tiers = unwrap(tiersResponse) as unknown as Schemas['AccessTierDto'][];
  const { items: courses } = unwrapList<Schemas['AdminCourseListItemDto']>(coursesResponse);

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Pendaftaran dan pembayaran</span>
            <h1 className="pageTitle">Paket akses</h1>
            <p className="pageSub">
              Atur harga sekali bayar, masa akses, urutan tampilan, dan kursus di setiap paket.
            </p>
          </div>
        </div>
        <AccessTierManager initialTiers={tiers} courses={courses} />
      </main>
    </AppShell>
  );
}

