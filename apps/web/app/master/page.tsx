import type { Metadata } from 'next';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { Courses, Plus, Users } from '../components/icons';
import { serverClient, unwrap, unwrapList } from '../lib/api';
import { requirePermission } from '../lib/session';

export const metadata: Metadata = { title: 'Dashboard · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

/** Batas halaman yang diambil API dalam satu permintaan. */
const UKURAN_HALAMAN = 100;
/**
 * Batas pengaman agar katalog yang tumbuh tak terduga tidak berubah menjadi
 * puluhan permintaan berantai hanya untuk memuat dashboard.
 */
const MAKS_HALAMAN = 10;

type Course = Schemas['AdminCourseListItemDto'];
type User = Schemas['AdminUserListItemDto'];
type Analytics = Schemas['DashboardAnalyticsDto'];

export default async function MasterDashboardPage() {
  const user = await requirePermission('courses.manage', '/master');
  const client = await serverClient();
  const [courses, students, activeStudents, analyticsResponse] = await Promise.all([
    client.GET('/api/v1/admin/courses', { params: { query: { page: 1, pageSize: 100 } } }),
    client.GET('/api/v1/admin/users', {
      params: { query: { page: 1, pageSize: 1, role: 'STUDENT' } },
    }),
    client.GET('/api/v1/admin/users', {
      params: { query: { page: 1, pageSize: 1, role: 'STUDENT', status: 'ACTIVE' } },
    }),
    client.GET('/api/v1/admin/analytics/dashboard', {
      params: { query: { days: 30 } },
    }),
  ]);
  const courseList = unwrapList<Course>(courses);
  const studentList = unwrapList<User>(students);
  const activeList = unwrapList<User>(activeStudents);
  const analytics = unwrap<Analytics>(analyticsResponse);

  // Jumlah enrollment, materi, dan kursus terbit dijumlahkan dari daftar
  // kursus — dan sebelumnya hanya dari halaman pertama. Begitu katalognya
  // melewati 100 kursus, ketiga angka itu diam-diam menjadi lebih kecil dari
  // yang sebenarnya: angka yang salah tanpa satu pun tanda bahwa ia salah.
  // Sisanya kini ikut diambil, dengan batas agar tidak menjadi rantai
  // permintaan yang panjang.
  const semuaKursus = [...courseList.items];
  const halamanTersisa = Math.min(courseList.meta.totalPages, MAKS_HALAMAN);
  for (let halaman = 2; halaman <= halamanTersisa; halaman += 1) {
    const lanjutan = unwrapList<Course>(
      await client.GET('/api/v1/admin/courses', {
        params: { query: { page: halaman, pageSize: UKURAN_HALAMAN } },
      }),
    );
    semuaKursus.push(...lanjutan.items);
  }
  const terhitungPenuh = semuaKursus.length >= courseList.meta.total;

  const enrollmentTotal = semuaKursus.reduce((sum, course) => sum + course.enrollmentCount, 0);
  const lessonTotal = semuaKursus.reduce((sum, course) => sum + course.lessonCount, 0);
  const published = semuaKursus.filter((course) => course.status === 'PUBLISHED').length;

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <p className="eyebrow">Ringkasan akademi</p>
            <h1 className="pageTitle">Selamat datang, {user.fullName.split(' ')[0]}</h1>
            <p className="pageSub">Pantau peserta, materi, dan aktivitas akademi dari satu tempat.</p>
          </div>
          <Link className="btn" href="/master/courses/new">Tambahkan Kursus</Link>
        </div>

        <section className="metricGrid" aria-label="Metrik akademi">
          <Metric label="Total Pelajar" value={studentList.meta.total} note={`${activeList.meta.total} aktif`} />
          <Metric
            label="Total Kursus"
            value={courseList.meta.total}
            note={terhitungPenuh ? `${published} diterbitkan` : `${published} diterbitkan dari yang terhitung`}
          />
          <Metric
            label="Enrollment"
            value={enrollmentTotal}
            note={terhitungPenuh ? 'Akses kursus aktif & historis' : `Dari ${semuaKursus.length} kursus teratas`}
          />
          <Metric
            label="Materi"
            value={lessonTotal}
            note={terhitungPenuh ? 'Di seluruh kursus' : `Dari ${semuaKursus.length} kursus teratas`}
          />
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
                  <span className={`courseThumb${course.thumbnailUrl ? ' hasImage' : ''}`} aria-hidden="true">
                    {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" /> : course.title.slice(0, 1)}
                  </span>
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
              <span className="actionIcon"><Plus size={20} /></span>
              <span><strong>Tambahkan kursus</strong><small>Susun materi pembelajaran.</small></span>
            </Link>
            <Link href="/master/users" className="card actionCard">
              <span className="actionIcon"><Users size={20} /></span>
              <span><strong>Kelola pengguna</strong><small>Undang dan atur akses Pelajar.</small></span>
            </Link>
            <Link href="/master/courses" className="card actionCard">
              <span className="actionIcon"><Courses size={20} /></span>
              <span><strong>Lihat semua kursus</strong><small>Periksa status dan performa.</small></span>
            </Link>
          </aside>
        </section>

        <section className="analyticsSection" aria-labelledby="analytics-title">
          <div className="sectionTitleRow">
            <div>
              <p className="eyebrow">Analytics pembelajaran</p>
              <h2 id="analytics-title">Aktivitas 30 hari terakhir</h2>
              <p className="pageSub">Diolah dari aktivitas belajar yang tercatat di seluruh kursus.</p>
            </div>
            <span className="analyticsPeriod">30 hari</span>
          </div>

          <div className="analyticsMetricGrid">
            <AnalyticsMetric
              label="Pelajar aktif"
              value={analytics.summary.activeLearners}
              note="Pelajar unik yang membuka materi"
            />
            <AnalyticsMetric
              label="Materi dibuka"
              value={analytics.summary.lessonOpens}
              note="Total pembukaan materi"
            />
            <AnalyticsMetric
              label="Materi selesai"
              value={analytics.summary.lessonCompletions}
              note="Penyelesaian yang tercatat"
            />
            <AnalyticsMetric
              label="Waktu belajar"
              value={analytics.summary.learningMinutes}
              suffix=" menit"
              note="Akumulasi durasi aktivitas"
            />
          </div>

          <div className="analyticsGrid">
            <CourseRanking courses={analytics.courses} />
            <DailyActivity daily={analytics.daily} />
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function AnalyticsMetric({
  label,
  value,
  note,
  suffix = '',
}: {
  label: string;
  value: number;
  note: string;
  suffix?: string;
}) {
  return (
    <article className="card analyticsMetric">
      <span>{label}</span>
      <strong>{value.toLocaleString('id-ID')}{suffix}</strong>
      <small>{note}</small>
    </article>
  );
}

function CourseRanking({ courses }: { courses: Analytics['courses'] }) {
  const ranked = courses.filter((course) => course.lessonOpens + course.lessonCompletions > 0);
  const maxActivity = Math.max(
    ...ranked.map((course) => course.lessonOpens + course.lessonCompletions),
    1,
  );

  return (
    <article className="card analyticsPanel">
      <div className="panelHead">
        <div>
          <h3>Kursus paling aktif</h3>
          <p className="pageSub">Berdasarkan materi yang dibuka dan diselesaikan.</p>
        </div>
        <Link className="btnTiny" href="/master/courses">Kelola kursus</Link>
      </div>
      <div className="analyticsRankList">
        {ranked.slice(0, 5).map((course, index) => {
          const activity = course.lessonOpens + course.lessonCompletions;
          return (
            <Link
              className="analyticsRankRow"
              href={`/master/courses/${course.courseId}`}
              key={course.courseId}
            >
              <span className="rankNumber">{index + 1}</span>
              <span className={`courseThumb${course.thumbnailUrl ? ' hasImage' : ''}`} aria-hidden="true">
                {course.thumbnailUrl
                  ? <img src={course.thumbnailUrl} alt="" />
                  : course.title.slice(0, 1)}
              </span>
              <span className="analyticsRankMain">
                <span className="analyticsRankTitle">
                  <strong>{course.title}</strong>
                  <small>{activity.toLocaleString('id-ID')} aktivitas</small>
                </span>
                <span className="analyticsBar" aria-hidden="true">
                  <span style={{ width: `${Math.max((activity / maxActivity) * 100, 4)}%` }} />
                </span>
                <span className="analyticsRankStats">
                  <small>{course.activeLearners} pelajar aktif</small>
                  <small>Rata-rata progres {Math.round(course.averageProgress)}%</small>
                  <small>Selesai {course.completionRate}%</small>
                </span>
              </span>
            </Link>
          );
        })}
        {ranked.length === 0 ? (
          <div className="analyticsEmpty">
            <strong>Belum ada aktivitas belajar</strong>
            <p>Data peringkat akan muncul setelah Pelajar mulai membuka materi.</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DailyActivity({ daily }: { daily: Analytics['daily'] }) {
  const recent = daily.slice(-7);
  const maxValue = Math.max(
    ...recent.map((item) => item.lessonOpens + item.lessonCompletions),
    1,
  );

  return (
    <article className="card analyticsPanel">
      <div className="panelHead">
        <div>
          <h3>Tren aktivitas</h3>
          <p className="pageSub">Tujuh hari dengan aktivitas terbaru.</p>
        </div>
      </div>
      {recent.length > 0 ? (
        <div className="dailyChart">
          {recent.map((item) => {
            const total = item.lessonOpens + item.lessonCompletions;
            return (
              <div className="dailyRow" key={item.date}>
                <time dateTime={item.date}>
                  {new Intl.DateTimeFormat('id-ID', {
                    day: '2-digit',
                    month: 'short',
                  }).format(new Date(item.date))}
                </time>
                <span className="dailyTrack">
                  <span style={{ width: `${Math.max((total / maxValue) * 100, 3)}%` }} />
                </span>
                <strong>{total}</strong>
              </div>
            );
          })}
          <div className="dailyLegend">
            <span><i className="legendDot" /> Pembukaan + penyelesaian materi</span>
          </div>
        </div>
      ) : (
        <div className="analyticsEmpty">
          <strong>Belum ada tren aktivitas</strong>
          <p>Grafik akan terisi setelah aktivitas belajar pertama tercatat.</p>
        </div>
      )}
    </article>
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
