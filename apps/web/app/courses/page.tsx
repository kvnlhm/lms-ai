import type { Metadata } from 'next';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { Search } from '../components/icons';
import { serverClient, unwrapList } from '../lib/api';
import { requireUser } from '../lib/session';

export const metadata: Metadata = { title: 'Kursus · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type CourseItem = Schemas['CourseListItemDto'];

interface Props {
  searchParams: Promise<{ page?: string; search?: string }>;
}

/**
 * Tautan pindah halaman yang tetap membawa kata pencarian.
 *
 * Sebelumnya tautannya hanya berisi `page`, sehingga menekan "Berikutnya" akan
 * membuang pencarian dan mengembalikan pengguna ke katalog penuh.
 */
function halamanKe(page: number, search?: string): string {
  const query = new URLSearchParams({ page: String(page) });
  if (search) query.set('search', search);
  return `/courses?${query.toString()}`;
}

export default async function CoursesPage({ searchParams }: Props) {
  const user = await requireUser('/courses');
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const client = await serverClient();
  const { items, meta } = unwrapList<CourseItem>(
    await client.GET('/api/v1/courses', {
      params: { query: { page, pageSize: 20, ...(params.search ? { search: params.search } : {}) } },
    }),
  );

  return (
    <AppShell user={user}>
      <main className="wrap">
        <h1 className="pageTitle">Kursus</h1>
        <p className="pageSub">
          {meta.total === 0
            ? 'Belum ada kursus yang terbit.'
            : `${meta.total} kursus terbit · halaman ${meta.page} dari ${meta.totalPages}`}
        </p>

        {/* Formulir GET biasa: halaman ini server component, dan pencarian yang
            tinggal di URL dapat ditandai, dibagikan, serta bertahan saat halaman
            dimuat ulang. */}
        <form className="catalogSearch" action="/courses">
          <label>
            <span className="srOnly">Cari kursus</span>
            <span className="catalogSearchIcon" aria-hidden="true">
              <Search size={17} />
            </span>
            <input
              type="search"
              name="search"
              defaultValue={params.search ?? ''}
              placeholder="Cari kursus"
            />
          </label>
          <button className="btn" type="submit">
            Cari
          </button>
          {params.search ? (
            <Link className="btn btnGhost" href="/courses">
              Hapus
            </Link>
          ) : null}
        </form>

        {items.length === 0 ? (
          <div className="card empty" style={{ marginTop: 24 }}>
            <p style={{ margin: 0 }}>
              {params.search
                ? `Tidak ada kursus yang cocok dengan “${params.search}”.`
                : 'Katalog masih kosong. Kursus akan muncul di sini setelah Master menerbitkannya.'}
            </p>
          </div>
        ) : (
          <div className="courseGrid" style={{ marginTop: 24 }}>
            {items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        {meta.totalPages > 1 ? (
          <nav
            aria-label="Navigasi halaman katalog"
            style={{ display: 'flex', gap: 10, marginTop: 26, justifyContent: 'center' }}
          >
            {meta.page > 1 ? (
              <Link className="btn btnGhost" href={halamanKe(meta.page - 1, params.search)}>
                Sebelumnya
              </Link>
            ) : null}
            {meta.page < meta.totalPages ? (
              <Link className="btn btnGhost" href={halamanKe(meta.page + 1, params.search)}>
                Berikutnya
              </Link>
            ) : null}
          </nav>
        ) : null}
      </main>
    </AppShell>
  );
}

function CourseCard({ course }: { course: CourseItem }) {
  const percent = course.enrollment?.progressPercent ?? 0;

  return (
    <Link href={`/courses/${course.id}`} className="card courseCard">
      <span className={`cover${course.thumbnailUrl ? ' hasImage' : ''}`}>
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt="" />
        ) : (
          <span className="coverText">{course.title}</span>
        )}
      </span>
      <div className="courseBody">
        <span className="courseName">{course.title}</span>
        <span className="eyebrow" style={{ marginTop: 4 }}>
          {course.category?.name ?? 'Tanpa kategori'}
        </span>
        {course.shortDescription ? <span className="courseDesc">{course.shortDescription}</span> : null}
        <div className="courseFoot">
          <div className="courseProgressLabel">
            <span>Progres belajar</span>
            <strong>{percent}%</strong>
          </div>
          <div className="progress" role="img" aria-label={`Progres ${percent} persen`}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="courseStats">
            <span>{course.moduleCount} bagian</span>
            <span>
              {course.enrollment?.status === 'COMPLETED'
                ? 'Selesai'
                : 'Sedang berjalan'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
