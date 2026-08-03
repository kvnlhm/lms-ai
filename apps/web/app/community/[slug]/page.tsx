import { notFound } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrap } from '../../lib/api';
import { can, requireUser } from '../../lib/session';
import { CommunityFeed, type CommunityChannel, type CommunityPost } from '../community-feed';
import { CommunityRail } from '../community-rail';

export const dynamic = 'force-dynamic';
export default async function CommunityChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser('/community'); const { slug } = await params; const client = await serverClient();
  const [channels, posts] = await Promise.all([
    client.GET('/api/v1/community/channels', {}).then((value) => unwrap<CommunityChannel[]>(value)),
    client.GET('/api/v1/community/channels/{slug}/posts', { params: { path: { slug }, query: { page: 1, pageSize: 30 } } }).then((value) => unwrap<CommunityPost[]>(value)),
  ]);
  if (!channels.some((item) => item.slug === slug)) notFound();
  return <AppShell user={user}><main className="communityLayout communityChatLayout"><CommunityFeed channels={channels} initialPosts={posts} activeSlug={slug} currentUserId={user.id} canModerate={can(user, 'discussions.moderate')} /><CommunityRail events={[]} announcements={[]} /></main></AppShell>;
}
