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
      <main className="wrap wrapNarrow">
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <Link href="/master" className="pill">
            <ArrowLeft size={13} /> Kelola Kursus
          </Link>
          <Link href={`/master/courses/${courseId}`} className="pill">
            Susun materi
          </Link>
        </div>

        <div className="pageHead">
          <div className="pageHeadMain">
            <h1 className="pageTitle">Pelajar terdaftar</h1>
            <p className="pageSub">
              {course.title} · {total} pelajar
            </p>
          </div>
        </div>

        <EnrollmentManager courseId={courseId} enrollments={enrollments} />
      </main>
    </AppShell>
  );
}
