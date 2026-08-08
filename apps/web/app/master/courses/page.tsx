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
import { TombolHapusKursus } from './hapus-kursus';

export const metadata: Metadata = { title: 'Kelola Kursus · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type AdminCourse = Schemas['AdminCourseListItemDto'];

const FILTERS = [
  { key: undefined, label: 'Semua' },
  { key: 'DRAFT', label: 'Draf' },
  { key: 'PUBLISHED', label: 'Terbit' },
  { key: 'ARCHIVED', label: 'Arsip' },
] as const;

/**
 * Kolom yang dapat diurutkan, beserta arah yang masuk akal saat pertama dipilih.
 *
 * Arah bawaannya berbeda per kolom dengan sengaja. "Diperbarui" hampir selalu
 * ditanyakan sebagai "mana yang terbaru", sedangkan "Judul" sebagai "dari A".
 * Memaksa keduanya mulai dari `asc` membuat setengah pilihan selalu menuntut
 * dua klik untuk sampai ke yang sebenarnya dimaksud.
 */
const SORTS = [
  { key: 'position', label: 'Urutan', bawaan: 'asc' },
  { key: 'title', label: 'Judul', bawaan: 'asc' },
  { key: 'status', label: 'Status', bawaan: 'asc' },
  { key: 'moduleCount', label: 'Bagian', bawaan: 'desc' },
  { key: 'enrollmentCount', label: 'Terdaftar', bawaan: 'desc' },
  { key: 'updatedAt', label: 'Diperbarui', bawaan: 'desc' },
  { key: 'publishedAt', label: 'Terbit', bawaan: 'desc' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];
type SortOrder = 'asc' | 'desc';

interface Props {
  searchParams: Promise<{
    status?: string;
    page?: string;
    search?: string;
    atur?: string;
    sort?: string;
    order?: string;
  }>;
}

/** Keadaan penyaring dan penyortiran yang dibawa setiap tautan di halaman ini. */
interface Keadaan {
  status?: string;
  search?: string;
  sort: SortKey;
  order: SortOrder;
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

  // Nilai dari URL diketik siapa saja, dan API menolak yang di luar daftar
  // dengan 422. Tanpa penyaringan di sini, satu huruf salah ketik pada tautan
  // yang dibagikan menggagalkan seluruh halaman, bukan hanya penyortirannya.
  const keadaan: Keadaan = {
    status,
    search,
    sort: SORTS.some((s) => s.key === params.sort) ? (params.sort as SortKey) : 'position',
    order: params.order === 'desc' ? 'desc' : 'asc',
  };

  const client = await serverClient();
  const { items, meta } = unwrapList<AdminCourse>(
    await client.GET('/api/v1/admin/courses', {
      params: {
        query: {
          page,
          pageSize: 20,
          sort: keadaan.sort,
          order: keadaan.order,
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
            {/* Penyortiran ikut dibawa formulir pencarian. Tanpa ini, mencari
                sesuatu diam-diam mengembalikan urutan ke bawaan — dan yang
                terlihat adalah hasil pencarian yang seolah tersusun acak. */}
            <input type="hidden" name="sort" value={keadaan.sort} />
            <input type="hidden" name="order" value={keadaan.order} />
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
              <Link className="btn btnGhost" href={buildHref({ ...keadaan, search: undefined }, 1)}>
                Hapus
              </Link>
            ) : null}
          </form>
        </section>

        <div className="toolbar courseStatusBar">
          {FILTERS.map((filter) => {
            const active = filter.key === status;
            return (
              <Link
                key={filter.label}
                href={buildHref({ ...keadaan, status: filter.key }, 1)}
                className={active ? 'pill pillAccent' : 'pill'}
                aria-current={active ? 'true' : undefined}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {/* Kepala tabel tetap dapat dipilih pada desktop. Di mobile kepala itu
            disembunyikan, jadi penyortiran juga tersedia sebagai kontrol native
            yang tidak memadat menjadi deretan tombol kecil. */}
        <section className="card sortCard" aria-label="Urutkan daftar kursus">
          <form className="sortBar" action="/master/courses">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {search ? <input type="hidden" name="search" value={search} /> : null}
            <label className="sortField">
              <span>Urutkan berdasarkan</span>
              <select name="sort" defaultValue={keadaan.sort}>
                {SORTS.map((sort) => <option key={sort.key} value={sort.key}>{sort.label}</option>)}
              </select>
            </label>
            <label className="sortField">
              <span>Arah</span>
              <select name="order" defaultValue={keadaan.order}>
                <option value="asc">Menaik ↑</option>
                <option value="desc">Menurun ↓</option>
              </select>
            </label>
            <button className="btn" type="submit">Terapkan</button>
          </form>
        </section>

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
                    <KepalaUrut kunci="position" label="#" keadaan={keadaan} kelas="num" />
                    <KepalaUrut kunci="title" label="Kursus" keadaan={keadaan} />
                    <KepalaUrut kunci="status" label="Status" keadaan={keadaan} />
                    <KepalaUrut kunci="moduleCount" label="Bagian" keadaan={keadaan} kelas="num" />
                    {/* Satu-satunya kolom yang tidak dapat diurutkan; angkanya
                        dihitung terpisah karena pelajaran berjarak dua relasi
                        dari kursus. Dibiarkan polos, bukan diberi tautan yang
                        tidak melakukan apa-apa. */}
                    <th className="num">Pelajaran</th>
                    <KepalaUrut
                      kunci="enrollmentCount"
                      label="Terdaftar"
                      keadaan={keadaan}
                      kelas="num"
                    />
                    <KepalaUrut kunci="updatedAt" label="Diperbarui" keadaan={keadaan} />
                    <th className="cellActions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((course) => (
                    <tr key={course.id}>
                      <td className="num cellPosition">
                        {course.position}
                      </td>
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
                          <TombolHapusKursus course={course} />
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
              <Link className="btn btnGhost" href={buildHref(keadaan, meta.page - 1)}>
                Sebelumnya
              </Link>
            ) : null}
            <span className="pill">
              Halaman {meta.page} dari {meta.totalPages}
            </span>
            {meta.page < meta.totalPages ? (
              <Link className="btn btnGhost" href={buildHref(keadaan, meta.page + 1)}>
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
 * Kepala kolom yang sekaligus menjadi tombol urut.
 *
 * Kolom yang sedang aktif menampilkan arahnya, dan menekannya lagi membalik
 * arah itu — perilaku yang sudah diharapkan orang dari sebuah tabel, sehingga
 * tidak perlu dijelaskan di mana pun.
 */
function KepalaUrut({
  kunci,
  label,
  keadaan,
  kelas,
}: {
  kunci: SortKey;
  label: string;
  keadaan: Keadaan;
  kelas?: string;
}) {
  const aktif = keadaan.sort === kunci;
  return (
    <th className={kelas} aria-sort={aktif ? (keadaan.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Link className={aktif ? 'sortHead sortHeadActive' : 'sortHead'} href={buildHref(arahkan(keadaan, kunci), 1)}>
        {label}
        <span aria-hidden="true" className="sortHeadArrow">
          {aktif ? (keadaan.order === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </Link>
    </th>
  );
}

/**
 * Keadaan baru setelah sebuah kolom dipilih.
 *
 * Memilih kolom yang sedang aktif membalik arahnya; memilih kolom lain memakai
 * arah bawaan kolom itu.
 */
function arahkan(keadaan: Keadaan, kunci: SortKey): Keadaan {
  if (keadaan.sort === kunci) {
    return { ...keadaan, order: keadaan.order === 'asc' ? 'desc' : 'asc' };
  }
  const bawaan = SORTS.find((s) => s.key === kunci)?.bawaan ?? 'asc';
  return { ...keadaan, sort: kunci, order: bawaan };
}

/**
 * Tautan yang membawa seluruh keadaan penyaringan dan penyortiran.
 *
 * Status, kata pencarian, urutan, dan halaman harus berjalan bersama: berpindah
 * halaman yang membuang kata pencarian, atau mengganti urutan yang membuang
 * penyaring status, sama-sama melempar pengguna kembali ke daftar penuh tanpa
 * penjelasan.
 *
 * Nilai bawaan tidak ditulis ke URL, supaya alamat halaman utama tetap bersih
 * dan dua alamat yang sebenarnya sama tidak terlihat berbeda.
 */
function buildHref(keadaan: Keadaan, page: number): string {
  const query = new URLSearchParams();
  if (keadaan.status) query.set('status', keadaan.status);
  if (keadaan.search) query.set('search', keadaan.search);
  if (keadaan.sort !== 'position') query.set('sort', keadaan.sort);
  if (keadaan.order !== 'asc') query.set('order', keadaan.order);
  if (page > 1) query.set('page', String(page));
  return query.toString() ? `/master/courses?${query.toString()}` : '/master/courses';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));
}
