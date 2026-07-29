import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../../components/app-shell';
import { ArrowLeft } from '../../../components/icons';
import { ApiError, serverClient, unwrap } from '../../../lib/api';
import { requirePermission } from '../../../lib/session';
import { CourseEditor } from './course-editor';

export const dynamic = 'force-dynamic';

type CourseDetail = Schemas['AdminCourseDetailDto'];

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function MasterCourseEditorPage({ params }: Props) {
  const { courseId } = await params;
  const user = await requirePermission('courses.manage', `/master/courses/${courseId}`);
  const client = await serverClient();

  let course: CourseDetail;
  try {
    course = unwrap<CourseDetail>(
      await client.GET('/api/v1/admin/courses/{courseId}', { params: { path: { courseId } } }),
    );
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
          <Link href={`/master/courses/${courseId}/enrollments`} className="pill">
            Pelajar terdaftar
          </Link>
        </div>

        <CourseEditor course={course} />
      </main>
    </AppShell>
  );
}
