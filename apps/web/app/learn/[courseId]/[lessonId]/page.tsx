import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../../components/app-shell';
import { ArrowLeft, ArrowRight } from '../../../components/icons';
import { ApiError, serverClient, unwrap } from '../../../lib/api';
import { requireUser } from '../../../lib/session';
import { BookmarkButton } from './bookmark-button';
import { CompleteButton } from './complete-button';
import { QuizRunner } from './quiz-runner';
import { VideoPlayer } from './video-player';

export const dynamic = 'force-dynamic';

type LearnCourse = Schemas['LearnCourseResponseDto'];
type LearnLesson = Schemas['LearnLessonResponseDto'];
type LearnLessonItem = Schemas['LearnLessonItemDto'];

const CONTENT_LABEL: Record<string, string> = {
  VIDEO: 'Video',
  TEXT: 'Bacaan',
  PDF: 'PDF',
  EXTERNAL_LINK: 'Tautan',
  QUIZ: 'Kuis',
};

/** Judul panggung: menyebut jenis materinya, bukan mengulang judul pelajaran. */
const STAGE_LABEL: Record<string, string> = {
  VIDEO: 'Video materi',
  PDF: 'Dokumen PDF',
  EXTERNAL_LINK: 'Materi di luar akademi',
};

interface Props {
  params: Promise<{ courseId: string; lessonId: string }>;
}

/** Menit menjadi bacaan yang wajar; 95 menit lebih mudah dibaca sebagai 1j 35m. */
function formatDurasi(menit: number): string {
  if (menit <= 0) return '—';
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa} menit`;
  return sisa === 0 ? `${jam} jam` : `${jam}j ${sisa}m`;
}

/** Nama host tujuan, atau null bila alamatnya tidak dapat dibaca. */
function hostTujuan(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Pelajaran, dibaca sekali per permintaan.
 *
 * `cache` dari React membuat judul di tab dan isi halaman berbagi satu
 * panggilan; tanpa itu, judul dinamis berarti memanggil API dua kali.
 */
const ambilPelajaran = cache(async (lessonId: string): Promise<LearnLesson> => {
  const client = await serverClient();
  return unwrap<LearnLesson>(
    await client.GET('/api/v1/learn/lessons/{lessonId}', { params: { path: { lessonId } } }),
  );
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = await ambilPelajaran(lessonId).catch(() => null);
  return { title: lesson ? `${lesson.title} · Academy AIPreneur` : 'Belajar · Academy AIPreneur' };
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
      ambilPelajaran(lessonId),
      (async () =>
        unwrap<LearnCourse>(
          await client.GET('/api/v1/learn/courses/{courseId}', { params: { path: { courseId } } }),
        ))(),
    ]);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isNotFound) notFound();
      // Prasyarat belum terpenuhi atau akses dicabut: kembalikan ke halaman
      // kursus, yang menjelaskan keadaannya, alih-alih halaman kosong.
      if (error.isForbidden) redirect(`/courses/${courseId}`);
    }
    throw error;
  }

  const ordered = course.modules.flatMap((module) => module.lessons.map((item) => item.id));
  const index = ordered.indexOf(lessonId);
  // Nomor urut hanya disebut bila pelajaran ini benar-benar ditemukan pada
  // daftar kursus. Sebelumnya urutan yang tidak ketemu diam-diam menjadi
  // "Pelajaran 1 dari N" — angka yang salah, disajikan sebagai fakta.
  const position = index >= 0 ? index + 1 : null;
  const isCompleted = lesson.status === 'COMPLETED';

  return (
    <AppShell user={user}>
      <div className="player">
        <div className="playerMain">
          <div className="playerStage">
            <Link href={`/courses/${courseId}`} className="pill playerBack">
              <ArrowLeft size={13} /> {course.course.title}
            </Link>

            <p className="lessonCounter">
              {position === null
                ? lesson.moduleTitle
                : `Pelajaran ${position} dari ${ordered.length} · ${lesson.moduleTitle}`}
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

            <LessonStage lesson={lesson} />

            {lesson.description ? <p className="lessonText">{lesson.description}</p> : null}
            {lesson.content.text ? <p className="lessonText">{lesson.content.text}</p> : null}

            {/* Pelajaran bacaan tanpa satu pun teks dulu menghasilkan halaman
                yang benar-benar kosong di bawah judulnya, tanpa penjelasan. */}
            {lesson.contentType === 'TEXT' && !lesson.description && !lesson.content.text ? (
              <p className="lessonText muted">Materi bacaan ini belum diisi.</p>
            ) : null}

            {lesson.contentType === 'QUIZ' ? (
              <QuizRunner
                courseId={courseId}
                lessonId={lessonId}
                nextLessonId={lesson.nextLessonId ?? null}
              />
            ) : null}
          </div>

          <div className="playerFoot">
            <BookmarkButton lessonId={lessonId} initiallyBookmarked={lesson.bookmarked} />
            {/* Materi kuis tidak punya tombol "tandai selesai": penyelesaiannya
                lahir dari nilai yang dihitung server, dan endpoint biasa memang
                menolak pelajaran berjenis kuis. */}
            {lesson.contentType === 'QUIZ' ? null : (
              <CompleteButton
                courseId={courseId}
                lessonId={lessonId}
                nextLessonId={lesson.nextLessonId ?? null}
                alreadyCompleted={isCompleted}
                openedAt={Date.now()}
              />
            )}
          </div>
        </div>

        <aside className="drawer" aria-label="Daftar pelajaran">
          <div className="drawerTop">
            <h2>Daftar pelajaran</h2>
            <span className="pill drawerPct">{course.progress.percent}%</span>
          </div>
          <div className="drawerList">
            {course.modules.map((module) => (
              <section key={module.id}>
                <h3 className="drawerSection">{module.title}</h3>
                <ul className="drawerLessonList">
                  {module.lessons.map((item) => (
                    <li key={item.id}>
                      <DrawerLesson courseId={courseId} lesson={item} current={item.id === lessonId} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function DrawerLesson({
  courseId,
  lesson,
  current,
}: {
  courseId: string;
  lesson: LearnLessonItem;
  current: boolean;
}) {
  const done = lesson.status === 'COMPLETED';

  return (
    <Link
      href={`/learn/${courseId}/${lesson.id}`}
      className={current ? 'drawerLesson drawerLessonCurrent' : 'drawerLesson'}
      aria-current={current ? 'page' : undefined}
    >
      <span
        className={done ? 'dot dotDone' : current ? 'dot dotCurrent' : 'dot'}
        aria-hidden="true"
      />
      <span className="drawerLessonBody">
        <span className="lessonName">{lesson.title}</span>
        {/* Jenis, durasi, dan penanda wajib sudah ikut terkirim sejak dulu.
            Tanpanya, kuis dan video tampak sama persis di daftar ini, dan
            pelajar tidak dapat menakar berapa lama sisa kursusnya. */}
        <span className="drawerLessonMeta">
          {CONTENT_LABEL[lesson.contentType] ?? lesson.contentType} ·{' '}
          {formatDurasi(lesson.estimatedMinutes)}
          {lesson.isRequired ? ' · Wajib' : ''}
        </span>
      </span>
      {done ? <span className="srOnly">Selesai</span> : null}
    </Link>
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

function LessonStage({ lesson }: { lesson: LearnLesson }) {
  // Panggung dulu menuliskan ulang judul pelajaran, padahal judul yang sama
  // sudah menjadi <h1> tepat di atasnya. Sekarang ia menyebut jenis materinya.
  const label = STAGE_LABEL[lesson.contentType] ?? 'Materi';

  if (
    (lesson.contentType === 'EXTERNAL_LINK' || lesson.contentType === 'PDF') &&
    lesson.content.externalUrl
  ) {
    const host = hostTujuan(lesson.content.externalUrl);
    return (
      <div className="stage">
        <div className="stageLabel">
          <h2>{label}</h2>
        </div>
        <a className="btn" href={lesson.content.externalUrl} target="_blank" rel="noreferrer noopener">
          {lesson.contentType === 'PDF' ? 'Buka dokumen PDF' : 'Buka materi eksternal'}
        </a>
        {/* Tautan ini membawa pelajar keluar dari akademi. Menyebut tujuannya
            lebih dulu membuat kepergian itu menjadi pilihan, bukan kejutan. */}
        {host ? <p className="stageNote stageHost">Membuka {host} di tab baru</p> : null}
      </div>
    );
  }

  if (lesson.contentType === 'TEXT' || lesson.contentType === 'QUIZ') {
    // Keduanya punya panggungnya sendiri di bawah judul, jadi tidak ada kotak
    // media yang perlu digambar di sini.
    return null;
  }

  if (lesson.contentType === 'VIDEO') {
    return (
      <div className="stage">
        <div className="stageLabel">
          <h2>{label}</h2>
        </div>
        <VideoPlayer lessonId={lesson.id} />
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="stageLabel">
        <h2>{label}</h2>
      </div>
      <p className="stageNote">Materi file belum tersedia.</p>
    </div>
  );
}
