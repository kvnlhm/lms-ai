import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../../components/app-shell';
import { ArrowLeft } from '../../../components/icons';
import { ApiError, serverClient, unwrap } from '../../../lib/api';
import { requirePermission } from '../../../lib/session';
import { CourseEditor } from './course-editor';
import { CourseSettings } from './course-settings';

export const dynamic = 'force-dynamic';

type CourseDetail = Schemas['AdminCourseDetailDto'];
type Category = Schemas['AdminCategoryDto'];

interface Props {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function MasterCourseEditorPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const { tab: requestedTab } = await searchParams;
  const tab = ['overview', 'lessons', 'settings'].includes(requestedTab ?? '')
    ? requestedTab!
    : 'overview';
  const user = await requirePermission('courses.manage', `/master/courses/${courseId}`);
  const client = await serverClient();

  let course: CourseDetail;
  let categories: Category[];
  try {
    [course, categories] = await Promise.all([
      client.GET('/api/v1/admin/courses/{courseId}', { params: { path: { courseId } } })
        .then((result) => unwrap<CourseDetail>(result)),
      client.GET('/api/v1/admin/course-categories', {})
        .then((result) => unwrap<Category[]>(result)),
    ]);
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
            <p className="pageSub">/{course.slug} · {course.modules.length} bagian</p>
          </div>
          <Link className="btn btnGhost" href={`/courses/${course.id}`} target="_blank" rel="noreferrer">
            Pratinjau sebagai pelajar
          </Link>
        </div>
        <nav className="courseTabs" aria-label="Kelola kursus">
          <Link href={`/master/courses/${courseId}?tab=overview`} aria-current={tab === 'overview' ? 'page' : undefined}>Overview</Link>
          <Link href={`/master/courses/${courseId}?tab=lessons`} aria-current={tab === 'lessons' ? 'page' : undefined}>Materi</Link>
          <Link href={`/master/courses/${courseId}/enrollments`}>Peserta</Link>
          <Link href={`/master/courses/${courseId}?tab=settings`} aria-current={tab === 'settings' ? 'page' : undefined}>Pengaturan</Link>
        </nav>

        {tab === 'overview' ? <CourseOverview course={course} /> : null}
        {tab === 'lessons' ? <CourseEditor course={course} /> : null}
        {tab === 'settings' ? <CourseSettings course={course} categories={categories} /> : null}
      </main>
    </AppShell>
  );
}

function CourseOverview({ course }: { course: CourseDetail }) {
  const lessons = course.modules.reduce((sum, item) => sum + item.lessons.length, 0);
  const required = course.modules.flatMap((item) => item.lessons).filter((item) => item.isRequired).length;
  return (
    <div className="courseOverview">
      <article className="card courseHeroAdmin">
        <div className={`courseHeroVisual${course.thumbnailUrl ? ' hasImage' : ''}`} aria-hidden="true">
          {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" /> : course.title.slice(0, 1)}
        </div>
        <div className="courseHeroBody">
          <span className="pill">{course.status === 'PUBLISHED' ? 'Terbit' : course.status === 'DRAFT' ? 'Draf' : 'Arsip'}</span>
          <h2>{course.title}</h2>
          <p>{course.shortDescription || 'Tambahkan deskripsi singkat pada tab Pengaturan.'}</p>
          <div className="courseMetaLine">{course.level} · {course.estimatedMinutes} menit</div>
        </div>
        <div className="inlineActions">
          <Link className="btn btnGhost" href={`/courses/${course.id}`} target="_blank" rel="noreferrer">Pratinjau</Link>
          <Link className="btn btnGhost" href={`/master/courses/${course.id}?tab=lessons`}>Edit materi</Link>
        </div>
      </article>
      <section className="metricGrid courseMetricGrid">
        <Metric label="Bagian" value={course.modules.length} />
        <Metric label="Materi" value={lessons} />
        <Metric label="Materi wajib" value={required} />
        <Metric label="Status" value={course.status === 'PUBLISHED' ? 'Terbit' : course.status === 'DRAFT' ? 'Draf' : 'Arsip'} />
      </section>
      <article className="card dashboardPanel">
        <div className="panelHead"><h2>Struktur kursus</h2></div>
        {course.modules.map((item, index) => (
          <div className="overviewModule" key={item.id}>
            <span>{index + 1}</span>
            <strong>{item.title}</strong>
            <small>{item.lessons.length} materi</small>
          </div>
        ))}
        {course.modules.length === 0 ? <p className="empty">Belum ada bagian.</p> : null}
      </article>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <article className="card metricCard"><span>{label}</span><strong>{value}</strong></article>;
}
