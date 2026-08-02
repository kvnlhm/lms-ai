import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../../../components/app-shell';
import { ArrowLeft } from '../../../../components/icons';
import { ApiError, serverClient, unwrap, unwrapList } from '../../../../lib/api';
import { requirePermission } from '../../../../lib/session';
import { EnrollmentManager } from './enrollment-manager';

export const metadata: Metadata = { title: 'Peserta kursus · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

/** Baris per halaman, mengikuti daftar admin lain. */
const UKURAN_HALAMAN = 20;

type Enrollment = Schemas['AdminEnrollmentDto'];
type CourseDetail = Schemas['AdminCourseDetailDto'];

interface Props {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function CourseEnrollmentsPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const user = await requirePermission(
    'enrollments.manage',
    `/master/courses/${courseId}/enrollments`,
  );
  const client = await serverClient();

  let course: CourseDetail;
  let enrollments: Enrollment[];
  let total: number;
  let totalPages: number;
  try {
    course = unwrap<CourseDetail>(
      await client.GET('/api/v1/admin/courses/{courseId}', { params: { path: { courseId } } }),
    );
    // Sebelumnya seratus baris pertama diambil tanpa kendali halaman, sehingga
    // kursus berpeserta lebih dari itu menyembunyikan sisanya — termasuk saat
    // seseorang perlu dicabut aksesnya. Judulnya pun menyebut jumlah penuh,
    // jadi angka dan isi daftarnya berbeda tanpa penjelasan.
    const list = unwrapList<Enrollment>(
      await client.GET('/api/v1/admin/courses/{courseId}/enrollments', {
        params: { path: { courseId }, query: { page, pageSize: UKURAN_HALAMAN } },
      }),
    );
    enrollments = list.items;
    total = list.meta.total;
    totalPages = list.meta.totalPages;
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }

  // Nomor halaman di luar jangkauan — entah diketik langsung atau tersisa
  // setelah peserta terakhirnya dicabut — akan menampilkan daftar kosong yang
  // hanya bisa ditinggalkan selangkah demi selangkah. Dibawa langsung ke
  // halaman terakhir yang benar-benar ada.
  if (totalPages > 0 && page > totalPages) {
    redirect(halamanKe(courseId, totalPages));
  }

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <Link href="/master/courses" className="pill">
            <ArrowLeft size={13} /> Kelola Kursus
          </Link>
        </div>

        <div className="courseAdminHead">
          <div>
            <h1 className="pageTitle">{course.title}</h1>
            <p className="pageSub">/{course.slug} · {total} peserta</p>
          </div>
        </div>

        <nav className="courseTabs" aria-label="Kelola kursus">
          <Link href={`/master/courses/${courseId}?tab=overview`}>Overview</Link>
          <Link href={`/master/courses/${courseId}?tab=lessons`}>Materi</Link>
          <Link href={`/master/courses/${courseId}/enrollments`} aria-current="page">
            Peserta
          </Link>
          <Link href={`/master/courses/${courseId}?tab=settings`}>Pengaturan</Link>
        </nav>

        <section className="courseMembers">
          <div className="panelHead">
            <div>
              <h2>Peserta ({total})</h2>
              <p className="pageSub">Atur akses dan status peserta kursus ini.</p>
            </div>
          </div>
          <EnrollmentManager courseId={courseId} enrollments={enrollments} />

          {totalPages > 1 ? (
            <nav className="toolbar enrollmentPager" aria-label="Navigasi halaman peserta">
              {page > 1 ? (
                <Link className="btn btnGhost" href={halamanKe(courseId, page - 1)}>
                  Sebelumnya
                </Link>
              ) : null}
              <span className="pill">
                Halaman {page} dari {totalPages}
              </span>
              {page < totalPages ? (
                <Link className="btn btnGhost" href={halamanKe(courseId, page + 1)}>
                  Berikutnya
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}

function halamanKe(courseId: string, page: number): string {
  const dasar = `/master/courses/${courseId}/enrollments`;
  return page > 1 ? `${dasar}?page=${page}` : dasar;
}
