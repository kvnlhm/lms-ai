import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { ArrowRight, Check } from '../../components/icons';
import { ApiError, serverClient, unwrap } from '../../lib/api';
import { requireUser } from '../../lib/session';
import { LiveSessions } from './live-sessions';

export const dynamic = 'force-dynamic';

type CourseDetail = Schemas['CourseDetailDto'];
type LearnCourse = Schemas['LearnCourseResponseDto'];

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function CourseDetailPage({ params }: Props) {
  const { courseId } = await params;
  const user = await requireUser(`/courses/${courseId}`);
  const client = await serverClient();

  let course: CourseDetail;
  try {
    course = unwrap<CourseDetail>(
      await client.GET('/api/v1/courses/{courseId}', { params: { path: { courseId } } }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }

  // Status per pelajaran hanya tersedia bagi peserta terdaftar. Bagi yang
  // belum terdaftar, silabus tetap ditampilkan tanpa status.
  let learn: LearnCourse | null = null;
  if (course.access.enrolled) {
    try {
      learn = unwrap<LearnCourse>(
        await client.GET('/api/v1/learn/courses/{courseId}', { params: { path: { courseId } } }),
      );
    } catch (error) {
      if (!(error instanceof ApiError && (error.isForbidden || error.isNotFound))) throw error;
    }
  }

  const statusByLesson = new Map(
    (learn?.modules ?? []).flatMap((module) => module.lessons.map((lesson) => [lesson.id, lesson.status])),
  );
  const progress = learn?.progress;
  const startTarget = learn?.nextLessonId ?? learn?.lastLessonId ?? null;

  return (
    <AppShell user={user}>
      <main className="wrap wrapNarrow">
        <div className="courseHeader">
          <div className="courseHeaderMain">
            <span className="eyebrow">{course.category?.name ?? 'Tanpa kategori'}</span>
            <h1 className="pageTitle" style={{ marginTop: 8 }}>
              {course.title}
            </h1>
            {course.shortDescription ? <p className="pageSub">{course.shortDescription}</p> : null}
          </div>

          {course.access.enrolled ? (
            <span className="inlineActions">
              <Link className="btnSecondary" href={`/learn/${course.id}/forum`}>
                Forum diskusi
              </Link>
              {startTarget ? (
                <Link className="btn" href={`/learn/${course.id}/${startTarget}`}>
                  {progress && progress.requiredLessonsCompleted > 0 ? 'Lanjutkan' : 'Mulai belajar'}
                  <ArrowRight size={16} />
                </Link>
              ) : null}
            </span>
          ) : null}
        </div>

        {!course.access.enrolled ? (
          <p className="notice noticeInfo" role="status">
            Kamu belum terdaftar pada kursus ini. Silabus di bawah dapat dilihat, tetapi isi
            pelajaran hanya terbuka setelah Master memberi akses.
          </p>
        ) : null}

        {course.access.enrolled ? <LiveSessions courseId={course.id} /> : null}

        {progress ? (
          <>
            <h2 className="sectionTitle" style={{ marginTop: 26 }}>
              Progres
            </h2>
            <section className="card progressCard">
              <div className="progressTop">
                <span>
                  {progress.requiredLessonsCompleted} dari {progress.requiredLessonsTotal} pelajaran
                  wajib selesai
                </span>
                <span className="progressPct">{progress.percent}%</span>
              </div>
              <div className="progress" role="img" aria-label={`Progres ${progress.percent} persen`}>
                <span style={{ width: `${progress.percent}%` }} />
              </div>
            </section>
          </>
        ) : null}

        <h2 className="sectionTitle">Konten</h2>
        <p className="pageSub" style={{ marginTop: -8, marginBottom: 16 }}>
          {course.modules.length} bagian ·{' '}
          {course.modules.reduce((total, module) => total + module.lessonCount, 0)} pelajaran
        </p>

        {course.modules.length === 0 ? (
          <div className="card empty">
            <p style={{ margin: 0 }}>Kursus ini belum memiliki materi.</p>
          </div>
        ) : (
          course.modules.map((module) => (
            <section key={module.id} className="moduleBlock">
              <div className="moduleBar">
                <h3>{module.title}</h3>
                <span className="moduleCount">{module.lessonCount} pelajaran</span>
              </div>
              <ul className="lessonList" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {module.lessons.map((lesson) => {
                  const status = statusByLesson.get(lesson.id);
                  const done = status === 'COMPLETED';
                  const openable = course.access.enrolled;

                  const body = (
                    <>
                      <span
                        className={done ? 'dot dotDone' : 'dot'}
                        aria-hidden="true"
                        style={{ display: 'grid', placeItems: 'center' }}
                      >
                        {done ? <Check size={11} strokeWidth={3.4} color="#08110d" /> : null}
                      </span>
                      <span className="lessonName">{lesson.title}</span>
                      <span className="lessonMeta">
                        {done ? 'Selesai' : `${lesson.estimatedMinutes} mnt`}
                      </span>
                    </>
                  );

                  return (
                    <li key={lesson.id}>
                      {openable ? (
                        <Link className="lessonRow" href={`/learn/${course.id}/${lesson.id}`}>
                          {body}
                        </Link>
                      ) : (
                        <div className="lessonRow" aria-disabled="true" style={{ cursor: 'default' }}>
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>
    </AppShell>
  );
}
