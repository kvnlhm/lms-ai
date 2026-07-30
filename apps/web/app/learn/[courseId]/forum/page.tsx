import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../../components/app-shell';
import { ArrowLeft } from '../../../components/icons';
import { ApiError, serverClient } from '../../../lib/api';
import { requireUser } from '../../../lib/session';
import { CourseForum } from './course-forum';

export const metadata: Metadata = { title: 'Forum kursus · AIPreneur Academy' };
export const dynamic = 'force-dynamic';

type LearnCourse = Schemas['LearnCourseResponseDto'];

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function CourseForumPage({ params }: Props) {
  const { courseId } = await params;
  const user = await requireUser(`/learn/${courseId}/forum`);
  const client = await serverClient();

  let course: LearnCourse;
  try {
    const response = await client.GET('/api/v1/learn/courses/{courseId}', {
      params: { path: { courseId } },
    });
    if (response.error !== undefined || !response.data) notFound();
    course = response.data.data as LearnCourse;
  } catch (error) {
    // Forum kursus yang tidak dimiliki tidak boleh dapat disimpulkan ada.
    if (error instanceof ApiError && (error.isNotFound || error.isForbidden)) notFound();
    throw error;
  }

  return (
    <AppShell user={user}>
      <main className="wrap wrapNarrow">
        <Link className="btnGhost btnSmall" href={`/courses/${courseId}`}>
          <ArrowLeft size={16} /> Kembali ke kursus
        </Link>
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">{course.course.title}</span>
            <h1 className="pageTitle">Forum diskusi</h1>
            <p className="pageSub">
              Bertanya, berbagi kendala, dan membantu sesama peserta kursus ini.
            </p>
          </div>
        </div>
        <CourseForum courseId={courseId} />
      </main>
    </AppShell>
  );
}
