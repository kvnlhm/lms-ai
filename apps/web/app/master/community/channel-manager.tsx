'use client';

import { useState, useTransition } from 'react';
import { ActionMenu } from '../../components/action-menu';
import { useNotifier } from '../../components/notifier';
import { browserClient, unwrap } from '../../lib/browser-api';
import type { CommunityChannel, CommunitySubchannel } from '../../community/community-feed';

type ManagedChannel = CommunityChannel & { archivedAt?: string | null; createdAt?: string };
type Draft = { name: string; description: string; isReadOnly: boolean };

export function ChannelManager({ initialChannels }: { initialChannels: ManagedChannel[] }) {
  const notifier = useNotifier();
  const [channels, setChannels] = useState(initialChannels);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', description: '', isReadOnly: false });
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const replace = (groupId: string, value: ManagedChannel) => setChannels((items) => items.map((item) => item.id === groupId ? value : item));

  function createChannel() {
    if (name.trim().length < 2) return;
    startTransition(async () => {
      try {
        const created = unwrap<ManagedChannel>(await browserClient().POST('/api/v1/admin/community/channels', { body: { name: name.trim(), description: description.trim() || undefined, position: channels.length } }));
        setChannels((items) => [...items, created]); setName(''); setDescription(''); setMessage('Channel berhasil dibuat. Tambahkan sub-channel sebagai ruang chat.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Channel gagal dibuat.'); }
    });
  }

  function createSubchannel(group: ManagedChannel) {
    if (draft.name.trim().length < 2) return;
    startTransition(async () => {
      try {
        const created = unwrap<CommunitySubchannel>(await browserClient().POST('/api/v1/admin/community/channels/{id}/subchannels', { params: { path: { id: group.id } }, body: { name: draft.name.trim(), description: draft.description.trim() || undefined, isReadOnly: draft.isReadOnly, position: group.subchannels.length } }));
        replace(group.id, { ...group, subchannels: [...group.subchannels, created] });
        setAddingTo(null); setDraft({ name: '', description: '', isReadOnly: false }); setMessage('Sub-channel berhasil dibuat.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Sub-channel gagal dibuat.'); }
    });
  }

  async function editChannel(group: ManagedChannel) {
    const nextName = await notifier.prompt('Edit channel', { label: 'Nama channel', defaultValue: group.name, minLength: 2, confirmLabel: 'Simpan' });
    if (nextName === null || nextName === group.name) return;
    startTransition(async () => {
      try { const updated = unwrap<ManagedChannel>(await browserClient().PATCH('/api/v1/admin/community/channels/{id}', { params: { path: { id: group.id } }, body: { name: nextName.trim() } })); replace(group.id, updated); setMessage('Channel berhasil diperbarui.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Channel gagal diperbarui.'); }
    });
  }

  async function editSubchannel(group: ManagedChannel, sub: CommunitySubchannel) {
    const nextName = await notifier.prompt('Edit sub-channel', { label: 'Nama sub-channel', defaultValue: sub.name, minLength: 2, confirmLabel: 'Simpan' });
    if (nextName === null || nextName === sub.name) return;
    startTransition(async () => {
      try { const updated = unwrap<CommunitySubchannel>(await browserClient().PATCH('/api/v1/admin/community/channels/subchannels/{id}', { params: { path: { id: sub.id } }, body: { name: nextName.trim() } })); replace(group.id, { ...group, subchannels: group.subchannels.map((item) => item.id === sub.id ? updated : item) }); setMessage('Sub-channel berhasil diperbarui.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Sub-channel gagal diperbarui.'); }
    });
  }

  async function archiveChannel(group: ManagedChannel) {
    if (!await notifier.confirm(`Hapus channel ${group.name}?`, { text: 'Semua sub-channel dan chat di dalamnya akan disembunyikan dan dapat dipulihkan.', confirmLabel: 'Hapus channel', danger: true })) return;
    startTransition(async () => {
      try { await browserClient().DELETE('/api/v1/admin/community/channels/{id}', { params: { path: { id: group.id } } }); replace(group.id, { ...group, archivedAt: new Date().toISOString() }); setMessage('Channel dipindahkan ke arsip.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Channel gagal diarsipkan.'); }
    });
  }

  function restoreChannel(group: ManagedChannel) {
    startTransition(async () => {
      try { const restored = unwrap<ManagedChannel>(await browserClient().POST('/api/v1/admin/community/channels/{id}/restore', { params: { path: { id: group.id } } })); replace(group.id, restored); setMessage('Channel berhasil dipulihkan.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Channel gagal dipulihkan.'); }
    });
  }

  async function archiveSubchannel(group: ManagedChannel, sub: CommunitySubchannel) {
    if (!await notifier.confirm(`Hapus sub-channel ${sub.name}?`, { text: 'Ruang chat akan disembunyikan dan dapat dipulihkan.', confirmLabel: 'Hapus sub-channel', danger: true })) return;
    startTransition(async () => {
      try { await browserClient().DELETE('/api/v1/admin/community/channels/subchannels/{id}', { params: { path: { id: sub.id } } }); replace(group.id, { ...group, subchannels: group.subchannels.map((item) => item.id === sub.id ? { ...item, archivedAt: new Date().toISOString() } : item) }); setMessage('Sub-channel dipindahkan ke arsip.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Sub-channel gagal diarsipkan.'); }
    });
  }

  function restoreSubchannel(group: ManagedChannel, sub: CommunitySubchannel) {
    startTransition(async () => {
      try { const restored = unwrap<CommunitySubchannel>(await browserClient().POST('/api/v1/admin/community/channels/subchannels/{id}/restore', { params: { path: { id: sub.id } } })); replace(group.id, { ...group, subchannels: group.subchannels.map((item) => item.id === sub.id ? restored : item) }); setMessage('Sub-channel berhasil dipulihkan.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Sub-channel gagal dipulihkan.'); }
    });
  }

  return <div className="channelManager">
    <section className="card channelForm"><div><span className="eyebrow">CHANNEL BARU</span><h2>Buat kelompok channel</h2><p className="communityMuted">Channel hanya menjadi kategori. Ruang chat dibuat sebagai sub-channel di dalamnya.</p></div><div className="field"><label htmlFor="channel-name">Nama channel</label><input id="channel-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Diskusi Kelas" /></div><div className="field"><label htmlFor="channel-desc">Keterangan</label><textarea id="channel-desc" value={description} onChange={(event) => setDescription(event.target.value)} /></div><button className="btn" type="button" disabled={pending || name.trim().length < 2} onClick={createChannel}>Buat channel</button></section>
    <section className="channelAdminList"><div className="channelListHeading"><div><span className="eyebrow">KOMUNITAS</span><h2>Channel dan sub-channel</h2></div><span>{channels.filter((item) => !item.archivedAt).length} channel</span></div>{message ? <p role="status" className="communityMessage">{message}</p> : null}
      {channels.filter((item) => !item.archivedAt).map((group) => <article className="card" key={group.id}>
        <div className="channelAdminItem"><span className="channelHash">#</span><div><strong>{group.name}</strong><small>{group.description ?? 'Tanpa keterangan'}</small><span className="channelAccessBadge">{group.subchannels.filter((item) => !item.archivedAt).length} sub-channel</span></div><ActionMenu><a href={`/community/${group.slug}`}>Buka channel</a><button type="button" onClick={() => void editChannel(group)}>Edit channel</button><button className="btnDanger" type="button" onClick={() => void archiveChannel(group)}>Hapus channel</button></ActionMenu></div>
        <div className="channelArchive"><div className="channelListHeading"><strong>Sub-channel</strong><button className="btn secondary" type="button" onClick={() => { setAddingTo(group.id); setDraft({ name: '', description: '', isReadOnly: false }); }}>Tambah sub-channel</button></div>
          {group.subchannels.map((sub) => <div className={`channelAdminItem${sub.archivedAt ? ' channelArchived' : ''}`} key={sub.id}><span className="channelHash">#</span><div><strong>{sub.name}</strong><small>{sub.description ?? 'Ruang chat'}</small><span className="channelAccessBadge">{sub.postCount} post · {sub.isReadOnly ? 'Hanya Master' : 'Master dan Pelajar'}</span></div><ActionMenu>{sub.archivedAt ? <button type="button" onClick={() => restoreSubchannel(group, sub)}>Pulihkan</button> : <><a href={`/community/${group.slug}/${sub.slug}`}>Buka chat</a><button type="button" onClick={() => void editSubchannel(group, sub)}>Edit sub-channel</button><button className="btnDanger" type="button" onClick={() => void archiveSubchannel(group, sub)}>Hapus</button></>}</ActionMenu></div>)}
          {addingTo === group.id ? <div className="channelEditForm"><div className="field"><label htmlFor={`sub-name-${group.id}`}>Nama sub-channel</label><input id={`sub-name-${group.id}`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div><div className="field"><label htmlFor={`sub-desc-${group.id}`}>Keterangan</label><input id={`sub-desc-${group.id}`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div><div className="field"><label htmlFor={`sub-access-${group.id}`}>Yang dapat mengirim</label><select id={`sub-access-${group.id}`} value={draft.isReadOnly ? 'MASTER' : 'ALL'} onChange={(event) => setDraft({ ...draft, isReadOnly: event.target.value === 'MASTER' })}><option value="ALL">Master dan Pelajar</option><option value="MASTER">Hanya Master</option></select></div><div className="channelAdminActions"><button className="btn secondary" type="button" onClick={() => setAddingTo(null)}>Batal</button><button className="btn" type="button" disabled={pending || draft.name.trim().length < 2} onClick={() => createSubchannel(group)}>Simpan</button></div></div> : null}
        </div>
      </article>)}
      {channels.filter((item) => item.archivedAt).map((group) => <article className="card channelAdminItem channelArchived" key={group.id}><span className="channelHash">#</span><div><strong>{group.name}</strong><small>Channel terarsip</small></div><ActionMenu><button type="button" onClick={() => restoreChannel(group)}>Pulihkan channel</button></ActionMenu></article>)}
    </section>
  </div>;
}
