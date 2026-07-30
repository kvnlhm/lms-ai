import type { Metadata } from 'next';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { StatusPill } from '../../components/status-pill';
import { serverClient, unwrapList } from '../../lib/api';
import { requirePermission } from '../../lib/session';

export const metadata: Metadata = { title: 'Kelola Kursus · LMS AIPrenuer' };
export const dynamic = 'force-dynamic';

type AdminCourse = Schemas['AdminCourseListItemDto'];

const FILTERS = [
  { key: undefined, label: 'Semua' },
  { key: 'DRAFT', label: 'Draf' },
  { key: 'PUBLISHED', label: 'Terbit' },
  { key: 'ARCHIVED', label: 'Arsip' },
] as const;

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function MasterCoursesPage({ searchParams }: Props) {
  const user = await requirePermission('courses.manage', '/master/courses');
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;
  const status = FILTERS.some((f) => f.key === params.status) ? params.status : undefined;

  const client = await serverClient();
  const { items, meta } = unwrapList<AdminCourse>(
    await client.GET('/api/v1/admin/courses', {
      params: {
        query: {
          page,
          pageSize: 20,
          ...(status ? { status: status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' } : {}),
        },
      },
    }),
  );

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <h1 className="pageTitle">Kursus</h1>
            <p className="pageSub">
              {meta.total} kursus, termasuk draf dan arsip yang tidak tampil di katalog pelajar.
            </p>
          </div>
          <Link className="btn" href="/master/courses/new">
            Kursus baru
          </Link>
        </div>

        <div className="toolbar">
          {FILTERS.map((filter) => {
            const active = filter.key === status;
            return (
              <Link
                key={filter.label}
                href={filter.key ? `/master/courses?status=${filter.key}` : '/master/courses'}
                className={active ? 'pill pillAccent' : 'pill'}
                aria-current={active ? 'true' : undefined}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className="card empty">
            <p style={{ margin: 0 }}>
              {status
                ? 'Tidak ada kursus dengan status ini.'
                : 'Belum ada kursus. Mulai dengan membuat kursus baru.'}
            </p>
          </div>
        ) : (
          <section className="card" style={{ padding: '6px 0' }}>
            <div className="tableWrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Kursus</th>
                    <th>Status</th>
                    <th className="num">Bagian</th>
                    <th className="num">Pelajaran</th>
                    <th className="num">Terdaftar</th>
                    <th>Diperbarui</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <span className="courseTableTitle">
                          <span className={`courseThumb${course.thumbnailUrl ? ' hasImage' : ''}`} aria-hidden="true">
                            {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" /> : course.title.slice(0, 1)}
                          </span>
                          <span>
                            <span className="cellTitle">{course.title}</span>
                            <span className="cellSub">
                              {course.category?.name ?? 'Tanpa kategori'} · /{course.slug}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <StatusPill status={course.status} />
                      </td>
                      <td className="num">{course.moduleCount}</td>
                      <td className="num">{course.lessonCount}</td>
                      <td className="num">{course.enrollmentCount}</td>
                      <td>{formatDate(course.updatedAt)}</td>
                      <td className="num">
                        <span className="inlineActions" style={{ justifyContent: 'flex-end' }}>
                          <Link className="btnTiny" href={`/master/courses/${course.id}`}>
                            Kelola
                          </Link>
                          <Link
                            className="btnTiny"
                            href={`/master/courses/${course.id}/enrollments`}
                          >
                            Pelajar
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {meta.totalPages > 1 ? (
          <nav
            aria-label="Navigasi halaman"
            style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'center' }}
          >
            {meta.page > 1 ? (
              <Link className="btn btnGhost" href={buildHref(status, meta.page - 1)}>
                Sebelumnya
              </Link>
            ) : null}
            {meta.page < meta.totalPages ? (
              <Link className="btn btnGhost" href={buildHref(status, meta.page + 1)}>
                Berikutnya
              </Link>
            ) : null}
          </nav>
        ) : null}
      </main>
    </AppShell>
  );
}

function buildHref(status: string | undefined, page: number): string {
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  query.set('page', String(page));
  return `/master/courses?${query.toString()}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));
}
