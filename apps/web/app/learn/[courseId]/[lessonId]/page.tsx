import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../../components/app-shell';
import { ArrowLeft, ArrowRight } from '../../../components/icons';
import { ApiError, serverClient, unwrap } from '../../../lib/api';
import { requireUser } from '../../../lib/session';
import { BookmarkButton } from './bookmark-button';
import { CompleteButton } from './complete-button';
import { VideoPlayer } from './video-player';

export const dynamic = 'force-dynamic';

type LearnCourse = Schemas['LearnCourseResponseDto'];
type LearnLesson = Schemas['LearnLessonResponseDto'];

interface Props {
  params: Promise<{ courseId: string; lessonId: string }>;
}

export default async function LessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const path = `/learn/${courseId}/${lessonId}`;
  const user = await requireUser(path);
  const client = await serverClient();

  let lesson: LearnLesson;
  let course: LearnCourse;
  try {
    [lesson, course] = await Promise.all([
      (async () =>
        unwrap<LearnLesson>(
          await client.GET('/api/v1/learn/lessons/{lessonId}', { params: { path: { lessonId } } }),
        ))(),
      (async () =>
        unwrap<LearnCourse>(
          await client.GET('/api/v1/learn/courses/{courseId}', { params: { path: { courseId } } }),
        ))(),
    ]);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isNotFound) notFound();
      // Prasyarat belum terpenuhi atau akses dicabut: kembalikan ke halaman
      // kursus, yang menjelaskan keadaannya, alih-alih menampilkan halaman kosong.
      if (error.isForbidden) redirect(`/courses/${courseId}`);
    }
    throw error;
  }

  const ordered = course.modules.flatMap((module) => module.lessons.map((item) => item.id));
  const index = ordered.indexOf(lessonId);
  const position = index >= 0 ? index + 1 : 1;
  const isCompleted = lesson.status === 'COMPLETED';

  return (
    <AppShell user={user}>
      <div className="player">
        <div className="playerMain">
          <div className="playerStage">
            <Link
              href={`/courses/${courseId}`}
              className="pill"
              style={{ marginBottom: 18, display: 'inline-flex' }}
            >
              <ArrowLeft size={13} /> {course.course.title}
            </Link>

            <p className="lessonCounter">
              Pelajaran {position} dari {ordered.length} · {lesson.moduleTitle}
            </p>

            <div className="lessonHeading">
              <h1>{lesson.title}</h1>
              <nav className="navPair" aria-label="Navigasi pelajaran">
                <NavArrow
                  href={lesson.previousLessonId ? `/learn/${courseId}/${lesson.previousLessonId}` : null}
                  label="Pelajaran sebelumnya"
                  direction="left"
                />
                <NavArrow
                  href={lesson.nextLessonId ? `/learn/${courseId}/${lesson.nextLessonId}` : null}
                  label="Pelajaran berikutnya"
                  direction="right"
                />
              </nav>
            </div>

            <LessonStage lesson={lesson} position={position} />

            {lesson.description ? <p className="lessonText">{lesson.description}</p> : null}
            {lesson.content.text ? <p className="lessonText">{lesson.content.text}</p> : null}
          </div>

          <div className="playerFoot">
            <BookmarkButton lessonId={lessonId} initiallyBookmarked={lesson.bookmarked} />
            <CompleteButton
              courseId={courseId}
              lessonId={lessonId}
              nextLessonId={lesson.nextLessonId ?? null}
              alreadyCompleted={isCompleted}
              openedAt={Date.now()}
            />
          </div>
        </div>

        <aside className="drawer" aria-label="Daftar pelajaran">
          <div className="drawerTop">
            <h2>Daftar pelajaran</h2>
            <span className="pill" style={{ marginLeft: 'auto' }}>
              {course.progress.percent}%
            </span>
          </div>
          <div className="drawerList">
            {course.modules.map((module) => (
              <section key={module.id}>
                <h3 className="drawerSection">{module.title}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {module.lessons.map((item) => {
                    const done = item.status === 'COMPLETED';
                    const current = item.id === lessonId;
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/learn/${courseId}/${item.id}`}
                          className={current ? 'drawerLesson drawerLessonCurrent' : 'drawerLesson'}
                          aria-current={current ? 'page' : undefined}
                        >
                          <span
                            className={done ? 'dot dotDone' : current ? 'dot dotCurrent' : 'dot'}
                            aria-hidden="true"
                          />
                          <span className="lessonName">{item.title}</span>
                          {done ? <span className="srOnly">Selesai</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function NavArrow({
  href,
  label,
  direction,
}: {
  href: string | null;
  label: string;
  direction: 'left' | 'right';
}) {
  const icon = direction === 'left' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />;

  if (!href) {
    return (
      <span className="navSq navSqDisabled" aria-hidden="true">
        {icon}
      </span>
    );
  }
  return (
    <Link href={href} className="navSq" aria-label={label} title={label}>
      {icon}
    </Link>
  );
}

function LessonStage({ lesson, position }: { lesson: LearnLesson; position: number }) {
  if (
    (lesson.contentType === 'EXTERNAL_LINK' || lesson.contentType === 'PDF') &&
    lesson.content.externalUrl
  ) {
    return (
      <div className="stage">
        <div className="stageLabel">
          <h2>
            {position}. {lesson.title}
          </h2>
        </div>
        <a className="btn" href={lesson.content.externalUrl} target="_blank" rel="noreferrer noopener">
          {lesson.contentType === 'PDF' ? 'Buka dokumen PDF' : 'Buka materi eksternal'}
        </a>
      </div>
    );
  }

  if (lesson.contentType === 'TEXT') {
    return null;
  }

  if (lesson.contentType === 'VIDEO') {
    return (
      <div className="stage">
        <div className="stageLabel">
          <h2>{position}. {lesson.title}</h2>
        </div>
        <VideoPlayer lessonId={lesson.id} />
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="stageLabel">
        <h2>
          {position}. {lesson.title}
        </h2>
      </div>
      <p className="stageNote">Materi file belum tersedia.</p>
    </div>
  );
}
