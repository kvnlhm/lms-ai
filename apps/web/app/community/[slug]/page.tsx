import { notFound } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrap } from '../../lib/api';
import { can, requireUser } from '../../lib/session';
import { CommunityFeed, type CommunityChannel, type CommunityPost } from '../community-feed';
import { CommunityRail, type CommunityAnnouncement, type CommunityEvent } from '../community-rail';
import type { Schemas } from '@lms/api-client';

export const dynamic = 'force-dynamic';
export default async function CommunityChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser('/community'); const { slug } = await params; const client = await serverClient();
  type Enrollment = Schemas['MyEnrollmentDto'];
  const [channels, posts, announcements, enrollments] = await Promise.all([
    client.GET('/api/v1/community/channels', {}).then((value) => unwrap<CommunityChannel[]>(value)),
    client.GET('/api/v1/community/channels/{slug}/posts', { params: { path: { slug }, query: { page: 1, pageSize: 30 } } }).then((value) => unwrap<CommunityPost[]>(value)),
    client.GET('/api/v1/me/announcements', { params: { query: { page: 1, pageSize: 4 } } }).then((value) => unwrap<CommunityAnnouncement[]>(value)),
    client.GET('/api/v1/me/enrollments', {}).then((value) => unwrap<Enrollment[]>(value)),
  ]);
  if (!channels.some((item) => item.slug === slug)) notFound();
  const groups = await Promise.all(enrollments.slice(0, 12).map((item) => client.GET('/api/v1/learn/courses/{courseId}/live-sessions', { params: { path: { courseId: item.course.id } } }).then((value) => unwrap<CommunityEvent[]>(value)).catch(() => [] as CommunityEvent[])));
  const events = groups.flat().filter((item) => item.status !== 'ENDED').sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return <AppShell user={user}><main className="communityLayout communityChatLayout"><CommunityFeed channels={channels} initialPosts={posts} activeSlug={slug} currentUserId={user.id} canModerate={can(user, 'discussions.moderate')} /><CommunityRail events={events} announcements={announcements} /></main></AppShell>;
}
