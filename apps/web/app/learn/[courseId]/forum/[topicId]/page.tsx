import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../../../components/app-shell';
import { ArrowLeft } from '../../../../components/icons';
import { requireUser } from '../../../../lib/session';
import { TopicThread } from './topic-thread';

export const metadata: Metadata = { title: 'Diskusi · AIPreneur Academy' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ courseId: string; topicId: string }>;
}

export default async function TopicPage({ params }: Props) {
  const { courseId, topicId } = await params;
  const user = await requireUser(`/learn/${courseId}/forum/${topicId}`);

  return (
    <AppShell user={user}>
      <main className="wrap wrapNarrow">
        <Link className="btnGhost btnSmall" href={`/learn/${courseId}/forum`}>
          <ArrowLeft size={16} /> Kembali ke forum
        </Link>
        <TopicThread topicId={topicId} currentUserId={user.id} />
      </main>
    </AppShell>
  );
}
