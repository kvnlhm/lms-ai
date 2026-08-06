import { notFound } from 'next/navigation';
import { AppShell } from '../../../../components/app-shell';
import { serverClient, unwrap } from '../../../../lib/api';
import { requireUser } from '../../../../lib/session';
import { ChecklistDetail, type ChecklistDetailData } from '../../../checklist-detail';

export const dynamic = 'force-dynamic';

export default async function ChecklistDetailPage({ params }: { params: Promise<{ slug: string; subchannelSlug: string; postId: string }> }) {
  const user = await requireUser('/community');
  const { slug, subchannelSlug, postId } = await params;
  const client = await serverClient();
  const item = await client.GET('/api/v1/community/checklist/{postId}', { params: { path: { postId } } })
    .then((value) => unwrap<ChecklistDetailData>(value))
    .catch(() => notFound());

  if (item.channel.type !== 'CHECKLIST' || item.channel.groupSlug !== slug || item.channel.slug !== subchannelSlug) notFound();
  const listUrl = `/community/${slug}/${subchannelSlug}`;
  return <AppShell user={user}><main className="communityChecklistDetailLayout"><ChecklistDetail item={item} listUrl={listUrl} /></main></AppShell>;
}
