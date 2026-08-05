import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from './components/app-shell';
import { ArrowRight } from './components/icons';
import { CommunityFeed, type CommunityChannel, type CommunityPost } from './community/community-feed';
import { CommunityRail, type CommunityAnnouncement, type CommunityEvent } from './community/community-rail';
import { serverClient, unwrap } from './lib/api';
import { can, requireUser } from './lib/session';

export const dynamic = 'force-dynamic';
type Enrollment = Schemas['MyEnrollmentDto'];
type ContinueLearning = Schemas['ContinueLearningDto'];

export default async function HomePage() {
  const user = await requireUser('/');
  const client = await serverClient();
  const [enrollments, continueLearning, channels, posts, announcements] = await Promise.all([
    client.GET('/api/v1/me/enrollments', {}).then((value) => unwrap<Enrollment[]>(value)),
    client.GET('/api/v1/me/continue-learning', {}).then((value) => unwrap<ContinueLearning | null>(value)),
    client.GET('/api/v1/community/channels', {}).then((value) => unwrap<CommunityChannel[]>(value)),
    client.GET('/api/v1/community/feed', { params: { query: { page: 1, pageSize: 8 } } }).then((value) => unwrap<CommunityPost[]>(value)),
    client.GET('/api/v1/me/announcements', { params: { query: { page: 1, pageSize: 4 } } }).then((value) => unwrap<CommunityAnnouncement[]>(value)),
  ]);
  const eventGroups = await Promise.all(enrollments.slice(0, 12).map((item) => client.GET('/api/v1/learn/courses/{courseId}/live-sessions', { params: { path: { courseId: item.course.id } } }).then((value) => unwrap<CommunityEvent[]>(value)).catch(() => [] as CommunityEvent[])));
  const events = eventGroups.flat().filter((item) => item.status !== 'ENDED').sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return <AppShell user={user}><main className="wrap learnerDashboard">
    <section className="learnerWelcome"><div><span className="eyebrow">Ringkasan belajar</span><h1 className="pageTitle">Selamat datang, {user.fullName}.</h1><p className="pageSub">{enrollments.length} kursus tersedia untuk kamu.</p></div><div className="learnerShortcuts"><Link href="/community">Buka komunitas <ArrowRight size={15} /></Link><Link href="/announcements">Lihat pengumuman <ArrowRight size={15} /></Link></div></section>
    <div id="monitoring-harian" className="learnerInsights"><div className="card"><span>Kursus tersedia</span><strong>{enrollments.length}</strong></div><div className="card"><span>Sedang dipelajari</span><strong>{enrollments.filter((item) => item.progress.percent > 0 && item.progress.percent < 100).length}</strong></div><div className="card"><span>Sudah selesai</span><strong>{enrollments.filter((item) => item.status === 'COMPLETED').length}</strong></div></div>
    {continueLearning ? <><h2 className="sectionTitle">Lanjutkan belajar</h2><ContinueCard item={continueLearning} /></> : null}
    <div className="sectionTitleRow"><h2 className="sectionTitle">Kursus kamu</h2><Link href="/courses">Lihat semua</Link></div>
    {enrollments.length === 0 ? <div className="card empty"><p>Belum ada kursus yang diterbitkan.</p></div> : <div className="courseGrid">{enrollments.slice(0, 6).map((item) => <EnrollmentCard key={item.enrollmentId} enrollment={item} />)}</div>}
    <section className="homeCommunitySection" aria-labelledby="home-community-heading">
      <div className="sectionTitleRow"><h2 id="home-community-heading" className="sectionTitle">Feed komunitas</h2><Link href="/community">Lihat semua</Link></div>
      <div className="homeCommunityGrid"><CommunityFeed channels={channels} initialPosts={posts} currentUserId={user.id} canModerate={can(user, 'discussions.moderate')} /><CommunityRail events={events} announcements={announcements} /></div>
    </section>
  </main></AppShell>;
}

function ContinueCard({ item }: { item: ContinueLearning }) { const target = item.lesson ? `/learn/${item.course.id}/${item.lesson.id}` : `/courses/${item.course.id}`; return <article className={`card progressCard${item.course.thumbnailUrl ? ' withThumbnail' : ''}`}>{item.course.thumbnailUrl ? <img className="continueThumbnail" src={item.course.thumbnailUrl} alt="" /> : null}<div className="continueContent"><div className="progressTop"><div><span className="eyebrow">{item.lesson?.moduleTitle ?? 'Kursus aktif'}</span><h3>{item.course.title}</h3><p>{item.lesson ? `Berikutnya: ${item.lesson.title}` : 'Buka kursus untuk mulai belajar.'}</p></div><span className="progressPct">{item.progressPercent}%</span></div><div className="progress"><span style={{ width: `${item.progressPercent}%` }} /></div><Link className="btn" href={target}>Lanjutkan <ArrowRight size={16} /></Link></div></article>; }
function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) { const { course, progress } = enrollment; return <Link href={`/courses/${course.id}`} className="card courseCard"><span className={`cover${course.thumbnailUrl ? ' hasImage' : ''}`}>{course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" /> : <span className="coverText">{course.title}</span>}</span><div className="courseBody"><span className="courseName">{course.title}</span><span className="eyebrow courseCategory">{course.category ?? 'Tanpa kategori'}</span>{course.shortDescription ? <span className="courseDesc">{course.shortDescription}</span> : null}<div className="courseFoot"><div className="courseProgressLabel"><span>Progres belajar</span><strong>{progress.percent}%</strong></div><div className="progress"><span style={{ width: `${progress.percent}%` }} /></div><div className="courseStats"><span>{progress.requiredLessonsCompleted} dari {progress.requiredLessonsTotal} materi wajib</span><span>{enrollment.status === 'COMPLETED' ? 'Selesai' : progress.percent > 0 ? 'Sedang berjalan' : 'Belum dimulai'}</span></div></div></div></Link>; }
