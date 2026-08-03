import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../../components/app-shell';
import { ArrowLeft } from '../../../components/icons';
import { requirePermission } from '../../../lib/session';
import { TopicModeration } from './topic-moderation';

export const metadata: Metadata = { title: 'Diskusi · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ topicId: string }>;
}

export default async function MasterForumTopicPage({ params }: Props) {
  const { topicId } = await params;
  const user = await requirePermission('discussions.moderate', `/master/forum/${topicId}`);

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <Link href="/master/forum" className="pill">
            <ArrowLeft size={13} /> Forum diskusi
          </Link>
        </div>
        <TopicModeration topicId={topicId} />
      </main>
    </AppShell>
  );
}
