import type { Schemas } from '@lms/api-client';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrapList } from '../../lib/api';
import { requirePermission } from '../../lib/session';
import { UserManager } from './user-manager';

export const dynamic = 'force-dynamic';

type User = Schemas['AdminUserListItemDto'];

interface Props {
  searchParams: Promise<{ search?: string; status?: string; role?: string; page?: string }>;
}

const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
const ROLES = ['MASTER', 'STUDENT'] as const;

export default async function MasterUsersPage({ searchParams }: Props) {
  const user = await requirePermission('users.read', '/master/users');
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const status = STATUSES.find((value) => value === params.status);
  const role = ROLES.find((value) => value === params.role);
  const client = await serverClient();
  const list = unwrapList<User>(
    await client.GET('/api/v1/admin/users', {
      params: {
        query: {
          page,
          pageSize: 20,
          ...(params.search ? { search: params.search } : {}),
          ...(status ? { status } : {}),
          ...(role ? { role } : {}),
        },
      },
    }),
  );

  return (
    <AppShell user={user}>
      <main className="wrap">
        <div className="pageHead">
          <div className="pageHeadMain">
            <h1 className="pageTitle">Pengguna</h1>
            <p className="pageSub">{list.meta.total} akun ditemukan.</p>
          </div>
        </div>

        <form className="toolbar" action="/master/users">
          <input
            className="input"
            type="search"
            name="search"
            defaultValue={params.search}
            placeholder="Cari nama atau email"
            aria-label="Cari pengguna"
          />
          <select className="input" name="role" defaultValue={role ?? ''} aria-label="Filter role">
            <option value="">Semua role</option>
            <option value="STUDENT">Pelajar</option>
            <option value="MASTER">Master</option>
          </select>
          <select
            className="input"
            name="status"
            defaultValue={status ?? ''}
            aria-label="Filter status"
          >
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Tidak aktif</option>
            <option value="SUSPENDED">Ditangguhkan</option>
          </select>
          <button className="btn" type="submit">Terapkan</button>
        </form>

        <UserManager users={list.items} />

        {list.meta.totalPages > 1 ? (
          <nav aria-label="Navigasi halaman" className="toolbar" style={{ justifyContent: 'center' }}>
            {page > 1 ? <Link className="btn btnGhost" href={href(params, page - 1)}>Sebelumnya</Link> : null}
            {page < list.meta.totalPages ? (
              <Link className="btn btnGhost" href={href(params, page + 1)}>Berikutnya</Link>
            ) : null}
          </nav>
        ) : null}
      </main>
    </AppShell>
  );
}

function href(params: Awaited<Props['searchParams']>, page: number): string {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);
  query.set('page', String(page));
  return `/master/users?${query.toString()}`;
}
