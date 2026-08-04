import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { ArrowRight, Check } from '../../components/icons';
import { PreviewBanner } from '../../components/preview-banner';
import { ApiError, serverClient, unwrap } from '../../lib/api';
import { requireUser } from '../../lib/session';
import { LiveSessions } from './live-sessions';

export const dynamic = 'force-dynamic';

type CourseDetail = Schemas['CourseDetailDto'];
type LearnCourse = Schemas['LearnCourseResponseDto'];
type SyllabusLesson = Schemas['CourseSyllabusLessonDto'];

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Pemula',
  INTERMEDIATE: 'Menengah',
  ADVANCED: 'Lanjutan',
};

const CONTENT_LABEL: Record<string, string> = {
  VIDEO: 'Video',
  TEXT: 'Bacaan',
  PDF: 'PDF',
  EXTERNAL_LINK: 'Tautan',
  QUIZ: 'Kuis',
};

interface Props {
  params: Promise<{ courseId: string }>;
}

/** Menit menjadi bacaan yang wajar; 95 menit lebih mudah dibaca sebagai 1j 35m. */
function formatDurasi(menit: number): string {
  if (menit <= 0) return '—';
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa} menit`;
  return sisa === 0 ? `${jam} jam` : `${jam}j ${sisa}m`;
}

/**
 * Detail kursus, dibaca sekali per permintaan.
 *
 * `cache` dari React membuat judul di tab dan isi halaman berbagi satu
 * panggilan yang sama; tanpa itu, menambahkan judul dinamis berarti memanggil
 * API dua kali untuk setiap kunjungan.
 */
const ambilKursus = cache(async (courseId: string): Promise<CourseDetail | null> => {
  const client = await serverClient();
  try {
    return unwrap<CourseDetail>(
      await client.GET('/api/v1/courses/{courseId}', { params: { path: { courseId } } }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  const course = await ambilKursus(courseId).catch(() => null);
  return { title: course ? `${course.title} · Academy AIPreneur` : 'Kursus · Academy AIPreneur' };
}

export default async function CourseDetailPage({ params }: Props) {
  const { courseId } = await params;
  const user = await requireUser(`/courses/${courseId}`);
  const client = await serverClient();

  const course = await ambilKursus(courseId);
  if (!course) notFound();

  let learn: LearnCourse | null = null;
  try {
    learn = unwrap<LearnCourse>(
      await client.GET('/api/v1/learn/courses/{courseId}', { params: { path: { courseId } } }),
    );
  } catch (error) {
    if (!(error instanceof ApiError && (error.isForbidden || error.isNotFound))) throw error;
  }

  const statusByLesson = new Map(
    (learn?.modules ?? []).flatMap((module) => module.lessons.map((lesson) => [lesson.id, lesson.status])),
  );
  const progress = learn?.progress;
  const startTarget = learn?.nextLessonId ?? learn?.lastLessonId ?? null;

  const jumlahPelajaran = course.modules.reduce((total, module) => total + module.lessonCount, 0);

  return (
    <AppShell user={user}>
      <main className="wrap wrapNarrow">
        {course.access.preview ? <PreviewBanner /> : null}
        <div className="courseHeader">
          <div className="courseHeaderMain">
            <span className="eyebrow">{course.category?.name ?? 'Tanpa kategori'}</span>
            <h1 className="pageTitle courseDetailTitle">{course.title}</h1>
            {course.shortDescription ? <p className="pageSub">{course.shortDescription}</p> : null}
            {/* Tingkat dan durasi sudah ikut terkirim sejak dulu tetapi tidak
                pernah ditampilkan, padahal keduanya yang pertama dicari
                pelajar sebelum memutuskan mulai. */}
            <p className="courseFacts">
              <span>{LEVEL_LABEL[course.level] ?? course.level}</span>
              <span>{formatDurasi(course.estimatedMinutes)}</span>
              <span>{course.modules.length} bagian</span>
              <span>{jumlahPelajaran} pelajaran</span>
            </p>
          </div>

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
        </div>

        {/* Deskripsi lengkap ditulis Master lewat pengaturan kursus, lalu
            selama ini tidak pernah sampai ke pelajar mana pun. Ditampilkan apa
            adanya sebagai teks: isinya berasal dari textarea biasa, jadi tidak
            boleh diperlakukan sebagai HTML. */}
        {course.description ? (
          <section className="card courseAbout">
            <h2 className="sectionTitle courseAboutTitle">Tentang kursus ini</h2>
            <p className="courseAboutBody">{course.description}</p>
          </section>
        ) : null}

        <LiveSessions courseId={course.id} />

        {progress ? (
          <>
            <h2 className="sectionTitle courseProgressHeading">Progres</h2>
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
        <p className="pageSub courseContentSub">
          {course.modules.length} bagian · {jumlahPelajaran} pelajaran
        </p>

        {course.modules.length === 0 || jumlahPelajaran === 0 ? (
          <div className="card emptyCard">
            {/* Bagian tanpa satu pun pelajaran dulu tetap digambar sebagai
                deretan judul kosong tanpa penjelasan. */}
            <p className="emptyCardTitle">Kursus ini belum memiliki materi.</p>
            <p className="muted emptyCardNote">
              Materi akan muncul di sini setelah Master menambahkannya.
            </p>
          </div>
        ) : (
          course.modules.map((module) => (
            <section key={module.id} className="moduleBlock">
              <div className="moduleBar">
                <h3>{module.title}</h3>
                <span className="moduleCount">
                  {module.lessonCount} pelajaran · {formatDurasi(module.estimatedMinutes)}
                </span>
              </div>
              {module.description ? <p className="moduleDesc">{module.description}</p> : null}
              <ul className="lessonList">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link className="lessonRow" href={`/learn/${course.id}/${lesson.id}`}>
                      <LessonBody
                        lesson={lesson}
                        done={statusByLesson.get(lesson.id) === 'COMPLETED'}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </AppShell>
  );
}

function LessonBody({ lesson, done }: { lesson: SyllabusLesson; done: boolean }) {
  return (
    <>
      <span className={done ? 'dot dotDone' : 'dot'} aria-hidden="true">
        {done ? <Check size={11} strokeWidth={3.4} color="#08110d" /> : null}
      </span>
      <span className="lessonName">
        {lesson.title}
        {/* Progres berbicara tentang "pelajaran wajib", tetapi silabusnya tidak
            pernah menunjukkan yang mana. Tanpa penanda ini, angka progres tidak
            dapat ditelusuri kembali ke daftar di bawahnya. */}
        {lesson.isRequired ? <span className="lessonBadge">Wajib</span> : null}
      </span>
      <span className="lessonMeta">
        <span>{CONTENT_LABEL[lesson.contentType] ?? lesson.contentType}</span>
        {/* Durasi tetap ditampilkan setelah selesai; sebelumnya ia digantikan
            kata "Selesai", sehingga pelajaran yang sudah dikerjakan justru
            kehilangan keterangannya. */}
        <span>{formatDurasi(lesson.estimatedMinutes)}</span>
        {done ? <span className="lessonDone">Selesai</span> : null}
      </span>
    </>
  );
}
