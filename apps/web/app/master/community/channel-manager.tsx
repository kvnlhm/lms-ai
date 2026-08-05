'use client';

import { useState, useTransition } from 'react';
import { ActionMenu } from '../../components/action-menu';
import { Plus } from '../../components/icons';
import { Modal } from '../../components/modal';
import { useNotifier } from '../../components/notifier';
import { browserClient, unwrap } from '../../lib/browser-api';
import type { CommunityChannel, CommunitySubchannel } from '../../community/community-feed';

type ManagedChannel = CommunityChannel & { archivedAt?: string | null; createdAt?: string };
type SubDraft = { name: string; description: string; isReadOnly: boolean; showInSidebar: boolean };
const EMPTY_SUB: SubDraft = { name: '', description: '', isReadOnly: false, showInSidebar: true };

export function ChannelManager({ initialChannels }: { initialChannels: ManagedChannel[] }) {
  const notifier = useNotifier();
  const [channels, setChannels] = useState(initialChannels);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [firstSub, setFirstSub] = useState<SubDraft>(EMPTY_SUB);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState<SubDraft>(EMPTY_SUB);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const replace = (groupId: string, value: ManagedChannel) => setChannels((items) => items.map((item) => item.id === groupId ? value : item));
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  function createChannel() {
    if (name.trim().length < 2 || firstSub.name.trim().length < 2) return;
    startTransition(async () => {
      try {
        const created = unwrap<ManagedChannel>(await browserClient().POST('/api/v1/admin/community/channels', { body: {
          name: name.trim(), description: description.trim() || undefined, position: channels.length,
          subchannelName: firstSub.name.trim(), subchannelDescription: firstSub.description.trim() || undefined,
          isReadOnly: firstSub.isReadOnly, showInSidebar: firstSub.showInSidebar,
        } }));
        setChannels((items) => [...items, created]); setExpanded((items) => new Set(items).add(created.id));
        setName(''); setDescription(''); setFirstSub(EMPTY_SUB); setShowCreate(false); setMessage('Channel beserta sub-channel pertamanya berhasil dibuat.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Channel gagal dibuat.'); }
    });
  }

  function createSubchannel(group: ManagedChannel) {
    if (draft.name.trim().length < 2) return;
    startTransition(async () => {
      try {
        const created = unwrap<CommunitySubchannel>(await browserClient().POST('/api/v1/admin/community/channels/{id}/subchannels', { params: { path: { id: group.id } }, body: { ...draft, name: draft.name.trim(), description: draft.description.trim() || undefined, position: group.subchannels.length } }));
        replace(group.id, { ...group, subchannels: [...group.subchannels, created] }); setAddingTo(null); setDraft(EMPTY_SUB); setMessage('Sub-channel berhasil ditambahkan.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Sub-channel gagal dibuat.'); }
    });
  }

  async function renameChannel(group: ManagedChannel) {
    const nextName = await notifier.prompt('Edit channel', { label: 'Nama channel', defaultValue: group.name, minLength: 2, confirmLabel: 'Simpan' });
    if (nextName === null || nextName === group.name) return;
    startTransition(async () => { try { replace(group.id, unwrap<ManagedChannel>(await browserClient().PATCH('/api/v1/admin/community/channels/{id}', { params: { path: { id: group.id } }, body: { name: nextName.trim() } }))); } catch (error) { setMessage(error instanceof Error ? error.message : 'Channel gagal diperbarui.'); } });
  }

  async function renameSubchannel(group: ManagedChannel, sub: CommunitySubchannel) {
    const nextName = await notifier.prompt('Edit sub-channel', { label: 'Nama sub-channel', defaultValue: sub.name, minLength: 2, confirmLabel: 'Simpan' });
    if (nextName === null || nextName === sub.name) return;
    startTransition(async () => { try { const updated = unwrap<CommunitySubchannel>(await browserClient().PATCH('/api/v1/admin/community/channels/subchannels/{id}', { params: { path: { id: sub.id } }, body: { name: nextName.trim() } })); replace(group.id, { ...group, subchannels: group.subchannels.map((item) => item.id === sub.id ? updated : item) }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Sub-channel gagal diperbarui.'); } });
  }

  function setGroupShortcut(group: ManagedChannel, value: boolean) {
    startTransition(async () => { try { const updated = unwrap<ManagedChannel>(await browserClient().PATCH('/api/v1/admin/community/channels/{id}', { params: { path: { id: group.id } }, body: { showInSidebar: value } })); replace(group.id, updated); setMessage(value ? 'Channel ditampilkan di sidebar Pelajar.' : 'Channel disembunyikan dari sidebar Pelajar.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Pintasan gagal diperbarui.'); } });
  }

  function setSubShortcut(group: ManagedChannel, sub: CommunitySubchannel, value: boolean) {
    startTransition(async () => { try { const updated = unwrap<CommunitySubchannel>(await browserClient().PATCH('/api/v1/admin/community/channels/subchannels/{id}', { params: { path: { id: sub.id } }, body: { showInSidebar: value } })); replace(group.id, { ...group, subchannels: group.subchannels.map((item) => item.id === sub.id ? updated : item) }); setMessage(value ? 'Sub-channel ditampilkan sebagai pintasan.' : 'Sub-channel disembunyikan dari sidebar.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Pintasan gagal diperbarui.'); } });
  }

  async function archiveChannel(group: ManagedChannel) {
    if (!await notifier.confirm(`Hapus channel ${group.name}?`, { text: 'Semua sub-channel dan chat di dalamnya akan disembunyikan dan dapat dipulihkan.', confirmLabel: 'Hapus channel', danger: true })) return;
    startTransition(async () => { try { await browserClient().DELETE('/api/v1/admin/community/channels/{id}', { params: { path: { id: group.id } } }); replace(group.id, { ...group, archivedAt: new Date().toISOString() }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Channel gagal diarsipkan.'); } });
  }

  async function archiveSubchannel(group: ManagedChannel, sub: CommunitySubchannel) {
    if (!await notifier.confirm(`Hapus sub-channel ${sub.name}?`, { text: 'Ruang chat akan disembunyikan. Channel harus tetap memiliki minimal satu sub-channel aktif.', confirmLabel: 'Hapus sub-channel', danger: true })) return;
    startTransition(async () => { try { await browserClient().DELETE('/api/v1/admin/community/channels/subchannels/{id}', { params: { path: { id: sub.id } } }); replace(group.id, { ...group, subchannels: group.subchannels.map((item) => item.id === sub.id ? { ...item, archivedAt: new Date().toISOString() } : item) }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Sub-channel gagal diarsipkan.'); } });
  }

  function restoreChannel(group: ManagedChannel) { startTransition(async () => { try { replace(group.id, unwrap<ManagedChannel>(await browserClient().POST('/api/v1/admin/community/channels/{id}/restore', { params: { path: { id: group.id } } }))); } catch (error) { setMessage(error instanceof Error ? error.message : 'Channel gagal dipulihkan.'); } }); }
  function restoreSubchannel(group: ManagedChannel, sub: CommunitySubchannel) { startTransition(async () => { try { const restored = unwrap<CommunitySubchannel>(await browserClient().POST('/api/v1/admin/community/channels/subchannels/{id}/restore', { params: { path: { id: sub.id } } })); replace(group.id, { ...group, subchannels: group.subchannels.map((item) => item.id === sub.id ? restored : item) }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Sub-channel gagal dipulihkan.'); } }); }

  const active = channels.filter((item) => !item.archivedAt);
  const archived = channels.filter((item) => item.archivedAt);
  const addingGroup = channels.find((item) => item.id === addingTo);
  return <div className="channelManager">
    <section className="channelAdminList"><div className="channelManagerHead"><div><span className="eyebrow">KOMUNITAS</span><h2>Channel dan sub-channel</h2><p className="communityMuted">Buka Channel untuk melihat ruang chat di dalamnya.</p></div><div><span>{active.length} channel</span><button className="btn" type="button" aria-expanded={showCreate} onClick={() => setShowCreate(true)}><Plus size={16} />Tambah channel</button></div></div>{message ? <p role="status" className="communityMessage">{message}</p> : null}
      <div className="channelAccordion">{active.map((group) => {
        const open = expanded.has(group.id); const activeSubs = group.subchannels.filter((item) => !item.archivedAt);
        return <article className={`channelAccordionItem${open ? ' open' : ''}`} key={group.id}>
          <div className="channelAccordionHead"><button type="button" className="channelExpand" aria-expanded={open} onClick={() => toggle(group.id)}><span className="channelChevron" aria-hidden="true">›</span><span className="channelHash">#</span><span><strong>{group.name}</strong><small>{group.description ?? `${activeSubs.length} ruang chat`}</small></span></button><span className="channelShortcutState">{group.showInSidebar ? 'Tampil di sidebar' : 'Tidak di sidebar'}</span><ActionMenu><a href={`/community/${group.slug}`}>Buka channel</a><button type="button" onClick={() => { setAddingTo(group.id); setDraft(EMPTY_SUB); setExpanded((items) => new Set(items).add(group.id)); }}>Tambah sub-channel</button><button type="button" onClick={() => void renameChannel(group)}>Edit channel</button><button type="button" onClick={() => setGroupShortcut(group, !group.showInSidebar)}>{group.showInSidebar ? 'Sembunyikan dari sidebar' : 'Tampilkan di sidebar'}</button><button className="btnDanger" type="button" onClick={() => void archiveChannel(group)}>Hapus channel</button></ActionMenu></div>
          {open ? <div className="channelAccordionPanel"><div className="channelSubHead"><div><strong>Sub-channel</strong><small>{activeSubs.length} ruang chat di dalam {group.name}</small></div></div>
            {group.subchannels.map((sub) => <div className={`channelSubRow${sub.archivedAt ? ' channelArchived' : ''}`} key={sub.id}><span className="channelHash">#</span><div><strong>{sub.name}</strong><small>{sub.description ?? 'Ruang chat'} · {sub.postCount} post</small></div><span className="channelShortcutState">{sub.showInSidebar ? 'Pintasan aktif' : 'Pintasan nonaktif'}</span><ActionMenu>{sub.archivedAt ? <button type="button" onClick={() => restoreSubchannel(group, sub)}>Pulihkan</button> : <><a href={`/community/${group.slug}/${sub.slug}`}>Buka chat</a><button type="button" onClick={() => void renameSubchannel(group, sub)}>Edit sub-channel</button><button type="button" onClick={() => setSubShortcut(group, sub, !sub.showInSidebar)}>{sub.showInSidebar ? 'Sembunyikan pintasan' : 'Tampilkan pintasan'}</button><button className="btnDanger" type="button" onClick={() => void archiveSubchannel(group, sub)}>Hapus</button></>}</ActionMenu></div>)}
          </div> : null}
        </article>;
      })}</div>
      {archived.length ? <div className="channelArchive"><div className="channelListHeading"><h2>Channel terarsip</h2><span>{archived.length}</span></div>{archived.map((group) => <div className="card channelAdminItem channelArchived" key={group.id}><span className="channelHash">#</span><div><strong>{group.name}</strong><small>Seluruh isinya tersembunyi</small></div><ActionMenu><button type="button" onClick={() => restoreChannel(group)}>Pulihkan channel</button></ActionMenu></div>)}</div> : null}
    </section>
    {showCreate ? <Modal title="Tambah channel" description="Buat Channel bersama sub-channel pertamanya." busy={pending} onClose={() => setShowCreate(false)}><div className="channelForm"><div className="field"><label htmlFor="channel-name">Nama channel</label><input id="channel-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Komunitas" /></div><div className="field"><label htmlFor="channel-desc">Keterangan channel</label><textarea id="channel-desc" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Jelaskan isi kelompok ini" /></div><div className="channelFormDivider"><strong>Sub-channel pertama</strong><small>Setiap Channel wajib memiliki minimal satu ruang chat.</small></div><SubchannelFields id="first" value={firstSub} onChange={setFirstSub} /><div className="channelAdminActions"><button className="btn secondary" type="button" disabled={pending} onClick={() => setShowCreate(false)}>Batal</button><button className="btn" type="button" disabled={pending || name.trim().length < 2 || firstSub.name.trim().length < 2} onClick={createChannel}>Buat channel</button></div></div></Modal> : null}
    {addingGroup ? <Modal title={`Tambah sub-channel ke ${addingGroup.name}`} description="Sub-channel menjadi ruang chat di dalam Channel ini." busy={pending} onClose={() => setAddingTo(null)}><div className="channelForm"><SubchannelFields id={addingGroup.id} value={draft} onChange={setDraft} /><div className="channelAdminActions"><button className="btn secondary" type="button" disabled={pending} onClick={() => setAddingTo(null)}>Batal</button><button className="btn" type="button" disabled={pending || draft.name.trim().length < 2} onClick={() => createSubchannel(addingGroup)}>Tambah sub-channel</button></div></div></Modal> : null}
  </div>;
}

function SubchannelFields({ id, value, onChange }: { id: string; value: SubDraft; onChange: (value: SubDraft) => void }) {
  return <div className="channelSubFields"><div className="field"><label htmlFor={`sub-name-${id}`}>Nama sub-channel</label><input id={`sub-name-${id}`} value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Contoh: Tanya Jawab" /></div><div className="field"><label htmlFor={`sub-desc-${id}`}>Keterangan</label><input id={`sub-desc-${id}`} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} placeholder="Topik ruang chat ini" /></div><div className="field"><label htmlFor={`sub-access-${id}`}>Yang dapat mengirim</label><select id={`sub-access-${id}`} value={value.isReadOnly ? 'MASTER' : 'ALL'} onChange={(event) => onChange({ ...value, isReadOnly: event.target.value === 'MASTER' })}><option value="ALL">Master dan Pelajar</option><option value="MASTER">Hanya Master</option></select></div><label className="channelShortcutCheck"><input type="checkbox" checked={value.showInSidebar} onChange={(event) => onChange({ ...value, showInSidebar: event.target.checked })} /><span><strong>Tampilkan sebagai pintasan</strong><small>Muncul di sidebar Pelajar.</small></span></label></div>;
}
