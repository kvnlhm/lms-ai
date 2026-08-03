import { AppShell } from '../../components/app-shell';
import { serverClient, unwrap } from '../../lib/api';
import { requirePermission } from '../../lib/session';
import type { CommunityChannel } from '../../community/community-feed';
import { ChannelManager } from './channel-manager';

export const dynamic = 'force-dynamic';
export default async function MasterCommunityPage() {
  const user = await requirePermission('discussions.moderate', '/master/community'); const client = await serverClient();
  const channels = await client.GET('/api/v1/admin/community/channels', {}).then((value) => unwrap<(CommunityChannel & { archivedAt?: string | null })[]>(value));
  return <AppShell user={user}><main className="masterContent"><div className="pageHead"><div className="pageHeadMain"><span className="eyebrow">Komunitas</span><h1 className="pageTitle">Channel komunitas</h1><p className="pageSub">Buat ruang percakapan yang akan muncul di sidebar Beranda pelajar.</p></div></div><ChannelManager initialChannels={channels} /></main></AppShell>;
}
