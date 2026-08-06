import { notFound } from 'next/navigation';
import { AppShell } from '../../../../../components/app-shell';
import { serverClient, unwrap } from '../../../../../lib/api';
import { requireUser } from '../../../../../lib/session';
import { ChecklistEditor } from '../../../../checklist-editor';
import type { ChecklistDetailData } from '../../../../checklist-detail';

export const dynamic = 'force-dynamic';

export default async function ChecklistEditPage({ params }: { params: Promise<{ slug: string; subchannelSlug: string; postId: string }> }) {
  const user = await requireUser('/community');
  const { slug, subchannelSlug, postId } = await params;
  const client = await serverClient();
  const item = await client.GET('/api/v1/community/checklist/{postId}', { params: { path: { postId } } }).then((value) => unwrap<ChecklistDetailData>(value)).catch(() => notFound());
  if (!item.canEdit || item.channel.groupSlug !== slug || item.channel.slug !== subchannelSlug) notFound();
  const detailUrl = `/community/${slug}/${subchannelSlug}/${postId}`;
  return <AppShell user={user}><main className="communityChecklistDetailLayout"><ChecklistEditor item={item} detailUrl={detailUrl} /></main></AppShell>;
}
