import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../../../components/app-shell';
import { ArrowLeft } from '../../../../components/icons';
import { ApiError, serverClient, unwrap, unwrapList } from '../../../../lib/api';
import { requirePermission } from '../../../../lib/session';
import { EnrollmentManager } from './enrollment-manager';

export const dynamic = 'force-dynamic';

type Enrollment = Schemas['AdminEnrollmentDto'];
type CourseDetail = Schemas['AdminCourseDetailDto'];

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function CourseEnrollmentsPage({ params }: Props) {
  const { courseId } = await params;
  const user = await requirePermission(
    'enrollments.manage',
    `/master/courses/${courseId}/enrollments`,
  );
  const client = await serverClient();

  let course: CourseDetail;
  let enrollments: Enrollment[];
  let total: number;
  try {
    course = unwrap<CourseDetail>(
      await client.GET('/api/v1/admin/courses/{courseId}', { params: { path: { courseId } } }),
    );
    const list = unwrapList<Enrollment>(
      await client.GET('/api/v1/admin/courses/{courseId}/enrollments', {
        params: { path: { courseId }, query: { page: 1, pageSize: 100 } },
      }),
    );
    enrollments = list.items;
    total = list.meta.total;
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
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
        </section>
      </main>
    </AppShell>
  );
}
