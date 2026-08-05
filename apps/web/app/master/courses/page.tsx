import type { Metadata } from 'next';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { ActionMenu } from '../../components/action-menu';
import { Search } from '../../components/icons';
import { StatusPill } from '../../components/status-pill';
import { serverClient, unwrapList } from '../../lib/api';
import { ambilSemuaKursus } from '../../lib/all-courses';
import { requirePermission } from '../../lib/session';
import { CourseOrder } from './course-order';

export const metadata: Metadata = { title: 'Kelola Kursus · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type AdminCourse = Schemas['AdminCourseListItemDto'];

const FILTERS = [
  { key: undefined, label: 'Semua' },
  { key: 'DRAFT', label: 'Draf' },
  { key: 'PUBLISHED', label: 'Terbit' },
  { key: 'ARCHIVED', label: 'Arsip' },
] as const;

interface Props {
  searchParams: Promise<{ status?: string; page?: string; search?: string; atur?: string }>;
}

export default async function MasterCoursesPage({ searchParams }: Props) {
  const user = await requirePermission('courses.manage', '/master/courses');
  const params = await searchParams;

  // Mode susun urutan berdiri sendiri, bukan lapisan di atas daftar biasa.
  // Penyaring status dan pencarian sengaja tidak ikut: urutannya satu untuk
  // seluruh katalog, dan menyusunnya sambil menyembunyikan sebagian kursus
  // berarti menyusun sesuatu yang tidak utuh terlihat.
  if (params.atur === '1') {
    const { courses, lengkap } = await ambilSemuaKursus();
    return (
      <AppShell user={user}>
        <main className="masterContent">
          <div className="pageHead">
            <div className="pageHeadMain">
              <h1 className="pageTitle">Urutan katalog</h1>
              <p className="pageSub">
                {courses.length} kursus, termasuk draf dan arsip. Draf ikut ditata supaya
                nomornya sudah benar ketika nanti diterbitkan.
              </p>
            </div>
            <Link className="btn btnGhost" href="/master/courses">
              Kembali ke daftar
            </Link>
          </div>
          <CourseOrder courses={courses} lengkap={lengkap} />
        </main>
      </AppShell>
    );
  }

  const page = Number.parseInt(params.page ?? '1', 10) || 1;
  const status = FILTERS.some((f) => f.key === params.status) ? params.status : undefined;
  const search = params.search?.trim() || undefined;

  const client = await serverClient();
  const { items, meta } = unwrapList<AdminCourse>(
    await client.GET('/api/v1/admin/courses', {
      params: {
        query: {
          page,
          pageSize: 20,
          ...(status ? { status: status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' } : {}),
          ...(search ? { search } : {}),
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
              {search
                ? `${meta.total} kursus cocok dengan “${search}”.`
                : `${meta.total} kursus, termasuk draf dan arsip yang tidak tampil di katalog pelajar.`}
            </p>
          </div>
          <div className="pageHeadActions">
            <Link className="btn btnGhost" href="/master/courses?atur=1">
              Atur urutan
            </Link>
            <Link className="btn" href="/master/courses/new">
              Tambahkan Kursus
            </Link>
          </div>
        </div>

        {/* Formulir GET biasa: kata pencariannya tinggal di URL sehingga dapat
            ditandai dan bertahan saat halaman dimuat ulang. Status yang sedang
            aktif ikut dibawa agar penyaringannya tidak hilang saat mencari. */}
        <section className="card filterCard" aria-label="Cari kursus">
          <form className="filterBar" action="/master/courses">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <label className="userSearch">
              <span className="srOnly">Cari kursus</span>
              <span aria-hidden="true">
                <Search size={17} />
              </span>
              <input
                type="search"
                name="search"
                defaultValue={search ?? ''}
                placeholder="Cari judul kursus"
              />
            </label>
            <button className="btn" type="submit">
              Cari
            </button>
            {search ? (
              <Link
                className="btn btnGhost"
                href={status ? `/master/courses?status=${status}` : '/master/courses'}
              >
                Hapus
              </Link>
            ) : null}
          </form>
        </section>

        <div className="toolbar">
          {FILTERS.map((filter) => {
            const active = filter.key === status;
            return (
              <Link
                key={filter.label}
                href={buildHref(filter.key, 1, search)}
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
              {search
                ? `Tidak ada kursus yang cocok dengan “${search}”.`
                : status
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
                    <th className="cellActions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((course) => (
                    <tr key={course.id}>
                      <td data-label="Kursus">
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
                      <td data-label="Status">
                        <StatusPill status={course.status} />
                      </td>
                      <td className="num" data-label="Bagian">{course.moduleCount}</td>
                      <td className="num" data-label="Pelajaran">{course.lessonCount}</td>
                      <td className="num" data-label="Terdaftar">{course.enrollmentCount}</td>
                      <td data-label="Diperbarui">{formatDate(course.updatedAt)}</td>
                      <td className="num cellActions">
                        <ActionMenu label="Aksi">
                          <Link href={`/master/courses/${course.id}`}>Kelola kursus</Link>
                          <Link href={`/courses/${course.id}`} target="_blank" rel="noreferrer">Pratinjau</Link>
                          <Link
                            href={`/master/courses/${course.id}/enrollments`}
                          >
                            Kelola peserta
                          </Link>
                        </ActionMenu>
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
              <Link className="btn btnGhost" href={buildHref(status, meta.page - 1, search)}>
                Sebelumnya
              </Link>
            ) : null}
            <span className="pill">
              Halaman {meta.page} dari {meta.totalPages}
            </span>
            {meta.page < meta.totalPages ? (
              <Link className="btn btnGhost" href={buildHref(status, meta.page + 1, search)}>
                Berikutnya
              </Link>
            ) : null}
          </nav>
        ) : null}
      </main>
    </AppShell>
  );
}

/**
 * Tautan yang membawa seluruh keadaan penyaringan.
 *
 * Status, halaman, dan kata pencarian harus berjalan bersama: berpindah
 * halaman yang membuang kata pencarian, atau mengganti status yang membuangnya,
 * sama-sama melempar pengguna kembali ke daftar penuh tanpa penjelasan.
 */
function buildHref(status: string | undefined, page: number, search?: string): string {
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (search) query.set('search', search);
  if (page > 1) query.set('page', String(page));
  return query.toString() ? `/master/courses?${query.toString()}` : '/master/courses';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));
}
