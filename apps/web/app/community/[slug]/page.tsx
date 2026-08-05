import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrap } from '../../lib/api';
import { requireUser } from '../../lib/session';
import type { CommunityChannel } from '../community-feed';

export const dynamic = 'force-dynamic';

export default async function CommunityChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser('/community');
  const { slug } = await params;
  const client = await serverClient();
  const channels = await client.GET('/api/v1/community/channels', {}).then((value) => unwrap<CommunityChannel[]>(value));
  const channel = channels.find((item) => item.slug === slug);
  if (!channel) notFound();

  return <AppShell user={user}><main className="masterContent">
    <div className="pageHead"><div className="pageHeadMain"><span className="eyebrow">Channel</span><h1 className="pageTitle">{channel.name}</h1><p className="pageSub">{channel.description ?? 'Pilih sub-channel untuk membuka ruang chat.'}</p></div></div>
    <section className="channelAdminList" aria-label={`Sub-channel ${channel.name}`}>
      <div className="channelListHeading"><div><span className="eyebrow">RUANG CHAT</span><h2>Sub-channel</h2></div><span>{channel.subchannels.length} sub-channel</span></div>
      {channel.subchannels.map((subchannel) => <Link className="card channelAdminItem" href={`/community/${channel.slug}/${subchannel.slug}`} key={subchannel.id}>
        <span className="channelHash">#</span><div><strong>{subchannel.name}</strong><small>{subchannel.description ?? 'Ruang percakapan komunitas'}</small><span className="channelAccessBadge">{subchannel.postCount} post</span></div><span aria-hidden="true">→</span>
      </Link>)}
      {channel.subchannels.length === 0 ? <div className="card empty"><p>Belum ada sub-channel di dalam channel ini.</p></div> : null}
    </section>
  </main></AppShell>;
}
