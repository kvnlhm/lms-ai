import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from './components/app-shell';
import { ArrowRight } from './components/icons';
import { serverClient, unwrap } from './lib/api';
import { requireUser } from './lib/session';

export const dynamic = 'force-dynamic';

type Enrollment = Schemas['MyEnrollmentDto'];
type ContinueLearning = Schemas['ContinueLearningDto'];
type HistoryPage = Schemas['LearningHistoryPageDto'];

export default async function HomePage() {
  const user = await requireUser('/');
  const client = await serverClient();
  const [enrollments, continueLearning, history] = await Promise.all([
    client.GET('/api/v1/me/enrollments', {}).then((result) => unwrap<Enrollment[]>(result)),
    client.GET('/api/v1/me/continue-learning', {}).then((result) => unwrap<ContinueLearning | null>(result)),
    client.GET('/api/v1/me/learning-history', { params: { query: { limit: 5 } } })
      .then((result) => unwrap<HistoryPage>(result)),
  ]);

  return (
    <AppShell user={user}>
      <main className="wrap">
        <h1 className="pageTitle">Selamat datang, {user.fullName}.</h1>
        <p className="pageSub">
          {enrollments.length > 0
            ? `${enrollments.length} kursus tersedia untuk kamu.`
            : 'Belum ada kursus yang bisa kamu akses.'}
        </p>

        {continueLearning ? (
          <>
            <h2 className="sectionTitle">Lanjutkan belajar</h2>
            <ContinueCard item={continueLearning} />
          </>
        ) : null}

        <h2 className="sectionTitle">Kursus kamu</h2>
        {enrollments.length === 0 ? (
          <div className="card empty">
            <p style={{ margin: 0 }}>
              Kamu belum terdaftar pada kursus mana pun. Hubungi Master untuk mendapatkan akses.
            </p>
          </div>
        ) : (
          <div className="courseGrid">
            {enrollments.map((enrollment) => (
              <EnrollmentCard key={enrollment.enrollmentId} enrollment={enrollment} />
            ))}
          </div>
        )}

        <div className="sectionTitleRow">
          <h2 className="sectionTitle">Aktivitas terbaru</h2>
          <Link href="/history">Lihat semua</Link>
        </div>
        {history.items.length === 0 ? (
          <div className="card empty"><p style={{ margin: 0 }}>Belum ada aktivitas belajar yang tercatat.</p></div>
        ) : (
          <div className="card recentActivity">
            {history.items.map((item) => (
              <Link key={item.id} href={item.lessonId && item.courseId ? `/learn/${item.courseId}/${item.lessonId}` : '/courses'}>
                <span>
                  <strong>{item.lessonTitle}</strong>
                  <small>{item.courseTitle}{item.moduleTitle ? ` · ${item.moduleTitle}` : ''}</small>
                </span>
                <time>{formatRelative(item.occurredAt)}</time>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function ContinueCard({ item }: { item: ContinueLearning }) {
  const target = item.lesson
    ? `/learn/${item.course.id}/${item.lesson.id}`
    : `/courses/${item.course.id}`;
  return (
    <article className="card progressCard">
      <div className="progressTop">
        <div>
          <span className="eyebrow">{item.lesson?.moduleTitle ?? 'Kursus aktif'}</span>
          <h3 style={{ margin: '6px 0 0', fontSize: 20 }}>{item.course.title}</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>
            {item.lesson ? `Berikutnya: ${item.lesson.title}` : 'Buka detail kursus untuk mulai belajar.'}
          </p>
        </div>
        <span className="progressPct">{item.progressPercent}%</span>
      </div>
      <div className="progress" role="img" aria-label={`Progres ${item.progressPercent} persen`}>
        <span style={{ width: `${item.progressPercent}%` }} />
      </div>
      <div style={{ marginTop: 18 }}>
        <Link className="btn" href={target}>
          {item.lastActivityAt ? 'Lanjutkan' : 'Mulai belajar'} <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) {
  const { course, progress } = enrollment;

  return (
    <Link href={`/courses/${course.id}`} className="card courseCard">
      <span className="cover">
        <span className="coverText">{course.title}</span>
      </span>
      <span className="courseBody">
        <span className="courseName">{course.title}</span>
        <span className="eyebrow" style={{ marginTop: 4 }}>
          {course.category ?? 'Tanpa kategori'}
        </span>
        {course.shortDescription ? <span className="courseDesc">{course.shortDescription}</span> : null}
        <span className="courseFoot">
          <span className="progress" role="img" aria-label={`Progres ${progress.percent} persen`}>
            <span style={{ width: `${progress.percent}%` }} />
          </span>
          <span className="courseStats">
            <span>{progress.percent}% selesai</span>
            <span>{enrollment.status === 'COMPLETED' ? 'Selesai' : 'Sedang berjalan'}</span>
          </span>
        </span>
      </span>
    </Link>
  );
}

function formatRelative(value: string): string {
  const date = new Date(value);
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffMinutes < 1_440) return `${Math.floor(diffMinutes / 60)} jam lalu`;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date);
}
