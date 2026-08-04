import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell';
import { requirePermission } from '../../lib/session';
import { TransactionList } from './transaction-list';

export const metadata: Metadata = { title: 'Transaksi · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
  const user = await requirePermission('commerce.manage', '/master/transactions');

  return (
    <AppShell user={user}>
      <main className="wrap">
        <div className="pageHead">
          <div className="pageHeadMain">
            <p className="eyebrow">Komersial</p>
            <h1 className="pageTitle">Transaksi</h1>
            <p className="pageSub">
              Pesanan pendaftaran beserta status pembayaran dan pengiriman undangannya.
            </p>
          </div>
        </div>

        <TransactionList />
      </main>
    </AppShell>
  );
}
