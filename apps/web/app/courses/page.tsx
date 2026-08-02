import type { Metadata } from 'next';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { Search } from '../components/icons';
import { serverClient, unwrap, unwrapList } from '../lib/api';
import { requireUser } from '../lib/session';

export const metadata: Metadata = { title: 'Kursus · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type CourseItem = Schemas['CourseListItemDto'];
type Category = Schemas['PublicCourseCategoryDto'];

const LEVEL = [
  ['BEGINNER', 'Pemula'],
  ['INTERMEDIATE', 'Menengah'],
  ['ADVANCED', 'Lanjutan'],
] as const;

type Level = (typeof LEVEL)[number][0];

const LEVEL_LABEL = new Map<string, string>(LEVEL);

/**
 * Nilai dari URL diketik siapa saja, jadi diperiksa sebelum diteruskan.
 *
 * Tanpa ini `?level=ngawur` akan diteruskan apa adanya, ditolak API sebagai
 * 422, dan seluruh halaman katalog gagal dimuat — hanya karena satu huruf
 * salah ketik pada tautan yang dibagikan.
 */
function bacaLevel(nilai: string | undefined): Level | undefined {
  return LEVEL.some(([value]) => value === nilai) ? (nilai as Level) : undefined;
}

interface Props {
  searchParams: Promise<{ page?: string; search?: string; category?: string; level?: string }>;
}

interface Penyaring {
  search?: string;
  category?: string;
  level?: Level;
}

/**
 * Tautan pindah halaman yang tetap membawa seluruh penyaring.
 *
 * Sebelumnya tautannya hanya berisi `page`, sehingga menekan "Berikutnya" akan
 * membuang pencarian dan mengembalikan pengguna ke katalog penuh.
 */
function halamanKe(page: number, penyaring: Penyaring): string {
  const query = new URLSearchParams({ page: String(page) });
  if (penyaring.search) query.set('search', penyaring.search);
  if (penyaring.category) query.set('category', penyaring.category);
  if (penyaring.level) query.set('level', penyaring.level);
  return `/courses?${query.toString()}`;
}

/** Menit menjadi bacaan yang wajar; 95 menit lebih mudah dibaca sebagai 1j 35m. */
function formatDurasi(menit: number): string {
  if (menit <= 0) return '—';
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa} menit`;
  return sisa === 0 ? `${jam} jam` : `${jam}j ${sisa}m`;
}

export default async function CoursesPage({ searchParams }: Props) {
  const user = await requireUser('/courses');
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;
  const penyaring: Penyaring = {
    search: params.search,
    category: params.category,
    level: bacaLevel(params.level),
  };
  const disaring = Boolean(penyaring.search || penyaring.category || penyaring.level);

  const client = await serverClient();
  const [daftar, kategori] = await Promise.all([
    client.GET('/api/v1/courses', {
      params: {
        query: {
          page,
          pageSize: 20,
          ...(penyaring.search ? { search: penyaring.search } : {}),
          ...(penyaring.category ? { category: penyaring.category } : {}),
          ...(penyaring.level ? { level: penyaring.level } : {}),
        },
      },
    }),
    client.GET('/api/v1/courses/categories', {}),
  ]);
  const { items, meta } = unwrapList<CourseItem>(daftar);
  const categories = unwrap<Category[]>(kategori);
  const namaKategori = categories.find((item) => item.slug === penyaring.category)?.name;

  return (
    <AppShell user={user}>
      <main className="wrap">
        <h1 className="pageTitle">Kursus</h1>
        <p className="pageSub">
          {/* Saat disaring, `meta.total` adalah jumlah yang cocok — bukan jumlah
              kursus terbit. Menyebutnya "kursus terbit" akan membuat katalog
              berisi 40 kursus terbaca seolah hanya punya 2. */}
          {meta.total === 0
            ? disaring
              ? 'Tidak ada kursus yang cocok dengan penyaring ini.'
              : 'Belum ada kursus yang terbit.'
            : disaring
              ? `${meta.total} kursus cocok · halaman ${meta.page} dari ${meta.totalPages}`
              : `${meta.total} kursus terbit · halaman ${meta.page} dari ${meta.totalPages}`}
        </p>

        {/* Formulir GET biasa: halaman ini server component, dan pencarian yang
            tinggal di URL dapat ditandai, dibagikan, serta bertahan saat halaman
            dimuat ulang. Tanpa input `page`, mengirim formulir selalu kembali ke
            halaman pertama — yang memang benar untuk penyaring baru. */}
        <form className="catalogSearch" action="/courses">
          <label>
            <span className="srOnly">Cari kursus</span>
            <span className="catalogSearchIcon" aria-hidden="true">
              <Search size={17} />
            </span>
            <input
              type="search"
              name="search"
              defaultValue={penyaring.search ?? ''}
              placeholder="Cari kursus"
            />
          </label>
          {categories.length > 0 ? (
            <label className="catalogSelect">
              <span className="srOnly">Kategori</span>
              <select name="category" defaultValue={penyaring.category ?? ''}>
                <option value="">Semua kategori</option>
                {categories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name} ({item.courseCount})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="catalogSelect">
            <span className="srOnly">Tingkat</span>
            <select name="level" defaultValue={penyaring.level ?? ''}>
              <option value="">Semua tingkat</option>
              {LEVEL.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">
            Cari
          </button>
          {disaring ? (
            <Link className="btn btnGhost" href="/courses">
              Hapus
            </Link>
          ) : null}
        </form>

        {disaring ? (
          <p className="muted catalogActive">
            Menampilkan
            {penyaring.search ? ` pencarian “${penyaring.search}”` : ' semua kursus'}
            {namaKategori ? ` · kategori ${namaKategori}` : ''}
            {penyaring.level ? ` · tingkat ${LEVEL_LABEL.get(penyaring.level) ?? penyaring.level}` : ''}
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="card emptyCard catalogEmpty">
            <p className="emptyCardTitle">
              {disaring
                ? 'Tidak ada kursus yang cocok.'
                : 'Katalog masih kosong. Kursus akan muncul di sini setelah Master menerbitkannya.'}
            </p>
            {disaring ? (
              <Link className="btnTiny" href="/courses">
                Tampilkan semua kursus
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="courseGrid catalogGrid">
            {items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        {meta.totalPages > 1 ? (
          <nav aria-label="Navigasi halaman katalog" className="catalogPager">
            {meta.page > 1 ? (
              <Link className="btn btnGhost" href={halamanKe(meta.page - 1, penyaring)}>
                Sebelumnya
              </Link>
            ) : null}
            <span className="pill">
              Halaman {meta.page} dari {meta.totalPages}
            </span>
            {meta.page < meta.totalPages ? (
              <Link className="btn btnGhost" href={halamanKe(meta.page + 1, penyaring)}>
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
  // Tiga keadaan, bukan dua. Sebelumnya kursus yang belum pernah dibuka pun
  // disebut "Sedang berjalan" — bersama progres 0% itu terbaca seolah pelajar
  // sudah memulainya lalu berhenti.
  const keadaan =
    course.enrollment?.status === 'COMPLETED'
      ? 'Selesai'
      : percent > 0
        ? 'Sedang berjalan'
        : 'Belum dimulai';

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
        <span className="eyebrow courseCategory">{course.category?.name ?? 'Tanpa kategori'}</span>
        {course.shortDescription ? <span className="courseDesc">{course.shortDescription}</span> : null}
        <div className="courseFoot">
          <div className="courseProgressLabel">
            <span>Progres belajar</span>
            <strong>{percent}%</strong>
          </div>
          <div className="progress" role="img" aria-label={`Progres ${percent} persen`}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="courseStats courseStatsWrap">
            {/* Tingkat dan durasi sudah ikut terkirim sejak dulu, hanya tidak
                pernah ditampilkan — padahal keduanya yang paling menentukan
                saat pelajar memilih kursus mana yang dibuka. */}
            <span>{LEVEL_LABEL.get(course.level) ?? course.level}</span>
            <span>{course.moduleCount} bagian</span>
            <span>{formatDurasi(course.estimatedMinutes)}</span>
            <span>{keadaan}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
