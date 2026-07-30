import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { serverClient, unwrapList } from '../lib/api';
import { requirePermission } from '../lib/session';

export const dynamic = 'force-dynamic';

type Course = Schemas['AdminCourseListItemDto'];
type User = Schemas['AdminUserListItemDto'];

export default async function MasterDashboardPage() {
  const user = await requirePermission('courses.manage', '/master');
  const client = await serverClient();
  const [courses, students, activeStudents] = await Promise.all([
    client.GET('/api/v1/admin/courses', { params: { query: { page: 1, pageSize: 100 } } }),
    client.GET('/api/v1/admin/users', {
      params: { query: { page: 1, pageSize: 1, role: 'STUDENT' } },
    }),
    client.GET('/api/v1/admin/users', {
      params: { query: { page: 1, pageSize: 1, role: 'STUDENT', status: 'ACTIVE' } },
    }),
  ]);
  const courseList = unwrapList<Course>(courses);
  const studentList = unwrapList<User>(students);
  const activeList = unwrapList<User>(activeStudents);
  const enrollmentTotal = courseList.items.reduce((sum, course) => sum + course.enrollmentCount, 0);
  const lessonTotal = courseList.items.reduce((sum, course) => sum + course.lessonCount, 0);
  const published = courseList.items.filter((course) => course.status === 'PUBLISHED').length;

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <p className="eyebrow">Ringkasan akademi</p>
            <h1 className="pageTitle">Selamat datang, {user.fullName.split(' ')[0]}</h1>
            <p className="pageSub">Pantau peserta, materi, dan aktivitas akademi dari satu tempat.</p>
          </div>
          <Link className="btn" href="/master/courses/new">Buat kursus</Link>
        </div>

        <section className="metricGrid" aria-label="Metrik akademi">
          <Metric label="Total Pelajar" value={studentList.meta.total} note={`${activeList.meta.total} aktif`} />
          <Metric label="Total Kursus" value={courseList.meta.total} note={`${published} diterbitkan`} />
          <Metric label="Enrollment" value={enrollmentTotal} note="Akses kursus aktif & historis" />
          <Metric label="Materi" value={lessonTotal} note="Di seluruh kursus" />
        </section>

        <section className="masterGrid">
          <article className="card dashboardPanel">
            <div className="panelHead">
              <div>
                <h2>Kursus terbaru</h2>
                <p className="pageSub">Kelola materi dan peserta kursus.</p>
              </div>
              <Link className="btnTiny" href="/master/courses">Lihat semua</Link>
            </div>
            <div className="courseQuickList">
              {courseList.items.slice(0, 5).map((course) => (
                <Link key={course.id} href={`/master/courses/${course.id}`} className="courseQuickRow">
                  <span className="courseThumb" aria-hidden="true">{course.title.slice(0, 1)}</span>
                  <span className="courseQuickMain">
                    <strong>{course.title}</strong>
                    <small>{course.lessonCount} materi · {course.enrollmentCount} peserta</small>
                  </span>
                  <span className="pill">{course.status === 'PUBLISHED' ? 'Terbit' : course.status === 'DRAFT' ? 'Draf' : 'Arsip'}</span>
                </Link>
              ))}
              {courseList.items.length === 0 ? <p className="empty">Belum ada kursus.</p> : null}
            </div>
          </article>

          <aside className="dashboardActions">
            <Link href="/master/courses/new" className="card actionCard">
              <span className="actionIcon">＋</span>
              <span><strong>Buat kursus baru</strong><small>Susun materi pembelajaran.</small></span>
            </Link>
            <Link href="/master/users" className="card actionCard">
              <span className="actionIcon">◎</span>
              <span><strong>Kelola pengguna</strong><small>Undang dan atur akses Pelajar.</small></span>
            </Link>
            <Link href="/master/courses" className="card actionCard">
              <span className="actionIcon">↗</span>
              <span><strong>Lihat semua kursus</strong><small>Periksa status dan performa.</small></span>
            </Link>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <article className="card metricCard">
      <span>{label}</span>
      <strong>{value.toLocaleString('id-ID')}</strong>
      <small>{note}</small>
    </article>
  );
}
