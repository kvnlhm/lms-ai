import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from './components/app-shell';
import { ArrowRight } from './components/icons';
import { serverClient, unwrap } from './lib/api';
import { requireUser } from './lib/session';

export const dynamic = 'force-dynamic';

type Enrollment = Schemas['MyEnrollmentDto'];

export default async function HomePage() {
  const user = await requireUser('/');
  const client = await serverClient();
  const enrollments = unwrap<Enrollment[]>(await client.GET('/api/v1/me/enrollments', {}));

  const inProgress = enrollments.filter((item) => item.progress.percent > 0 && item.status !== 'COMPLETED');
  const resume = inProgress[0] ?? enrollments[0];

  return (
    <AppShell user={user}>
      <main className="wrap">
        <h1 className="pageTitle">Selamat datang, {user.fullName}.</h1>
        <p className="pageSub">
          {enrollments.length > 0
            ? `${enrollments.length} kursus tersedia untuk kamu.`
            : 'Belum ada kursus yang bisa kamu akses.'}
        </p>

        {resume ? (
          <>
            <h2 className="sectionTitle">Lanjutkan belajar</h2>
            <ResumeCard enrollment={resume} />
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
      </main>
    </AppShell>
  );
}

function ResumeCard({ enrollment }: { enrollment: Enrollment }) {
  const { course, progress } = enrollment;
  const target = progress.lastLessonId
    ? `/learn/${course.id}/${progress.lastLessonId}`
    : `/courses/${course.id}`;

  return (
    <article className="card progressCard">
      <div className="progressTop">
        <div>
          <span className="eyebrow">{course.category ?? 'Kursus'}</span>
          <h3 style={{ margin: '6px 0 0', fontSize: 20, letterSpacing: '-0.02em' }}>{course.title}</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>
            {progress.requiredLessonsCompleted} dari {progress.requiredLessonsTotal} pelajaran wajib selesai
          </p>
        </div>
        <span className="progressPct">{progress.percent}%</span>
      </div>
      <div className="progress" role="img" aria-label={`Progres ${progress.percent} persen`}>
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <div style={{ marginTop: 18 }}>
        <Link className="btn" href={target}>
          {progress.lastLessonId ? 'Lanjutkan' : 'Mulai belajar'} <ArrowRight size={16} />
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
