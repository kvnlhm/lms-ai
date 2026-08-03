import type { Schemas } from '@lms/api-client';
import { AppShell } from '../components/app-shell';
import { serverClient, unwrap, unwrapList } from '../lib/api';
import { can, requireUser } from '../lib/session';
import { CommunityFeed, type CommunityChannel, type CommunityPost } from './community-feed';
import { CommunityRail, type CommunityAnnouncement, type CommunityEvent } from './community-rail';

export const dynamic = 'force-dynamic';
type Enrollment = Schemas['MyEnrollmentDto'];
export default async function CommunityPage() {
  const user = await requireUser('/community'); const client = await serverClient();
  const [channels, posts, announcements, enrollments] = await Promise.all([
    client.GET('/api/v1/community/channels', {}).then((value) => unwrap<CommunityChannel[]>(value)),
    client.GET('/api/v1/community/feed', { params: { query: { page: 1, pageSize: 20 } } }).then((value) => unwrapList<CommunityPost>(value)),
    client.GET('/api/v1/me/announcements', { params: { query: { page: 1, pageSize: 4 } } }).then((value) => unwrap<CommunityAnnouncement[]>(value)),
    client.GET('/api/v1/me/enrollments', {}).then((value) => unwrap<Enrollment[]>(value)),
  ]);
  const groups = await Promise.all(enrollments.slice(0, 12).map((item) => client.GET('/api/v1/learn/courses/{courseId}/live-sessions', { params: { path: { courseId: item.course.id } } }).then((value) => unwrap<CommunityEvent[]>(value)).catch(() => [] as CommunityEvent[])));
  const events = groups.flat().filter((item) => item.status !== 'ENDED').sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return <AppShell user={user}><main className="communityLayout"><CommunityFeed channels={channels} initialPosts={posts.items} initialTotal={posts.meta.total} currentUserId={user.id} canModerate={can(user, 'discussions.moderate')} /><CommunityRail events={events} announcements={announcements} /></main></AppShell>;
}
