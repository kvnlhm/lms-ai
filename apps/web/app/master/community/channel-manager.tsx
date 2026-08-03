'use client';

import { useState, useTransition } from 'react';
import { useNotifier } from '../../components/notifier';
import { browserClient, unwrap } from '../../lib/browser-api';
import type { CommunityChannel } from '../../community/community-feed';

type ManagedChannel = CommunityChannel & { archivedAt?: string | null; position?: number };
type ChannelDraft = { name: string; slug: string; description: string; position: number; isReadOnly: boolean };

function draftOf(channel: ManagedChannel): ChannelDraft {
  return {
    name: channel.name,
    slug: channel.slug,
    description: channel.description ?? '',
    position: channel.position ?? 0,
    isReadOnly: channel.isReadOnly,
  };
}

export function ChannelManager({ initialChannels }: { initialChannels: ManagedChannel[] }) {
  const notifier = useNotifier();
  const [channels, setChannels] = useState(initialChannels);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChannelDraft | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function create() {
    if (name.trim().length < 2) return;
    startTransition(async () => {
      try {
        const result = await browserClient().POST('/api/v1/admin/community/channels', {
          body: {
            name: name.trim(),
            description: description.trim() || undefined,
            isReadOnly: readOnly,
            position: channels.length,
          },
        });
        const created = unwrap<ManagedChannel>(result);
        setChannels((current) => [...current, { ...created, postCount: 0 }]);
        setName('');
        setDescription('');
        setReadOnly(false);
        setMessage('Channel berhasil dibuat.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Channel gagal dibuat.');
      }
    });
  }

  function beginEdit(channel: ManagedChannel) {
    setEditingId(channel.id);
    setDraft(draftOf(channel));
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function save(id: string) {
    if (!draft || draft.name.trim().length < 2 || draft.slug.trim().length < 2) return;
    startTransition(async () => {
      try {
        const result = await browserClient().PATCH('/api/v1/admin/community/channels/{id}', {
          params: { path: { id } },
          body: {
            name: draft.name.trim(),
            slug: draft.slug.trim().toLowerCase(),
            description: draft.description.trim() || undefined,
            position: draft.position,
            isReadOnly: draft.isReadOnly,
          },
        });
        const updated = unwrap<ManagedChannel>(result);
        setChannels((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item));
        cancelEdit();
        setMessage('Pengaturan channel berhasil disimpan.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Channel gagal diperbarui.');
      }
    });
  }

  /**
   * Mengarsipkan channel.
   *
   * Dulu satu tekan langsung menyembunyikan seluruh percakapan sebuah ruang
   * dari mata semua orang, tanpa bertanya dan tanpa jalan pulang. Sekarang ia
   * bertanya lebih dulu, dan menyebut bahwa isinya dapat dikembalikan.
   */
  function archive(channel: ManagedChannel) {
    void (async () => {
      const lanjut = await notifier.confirm(`Arsipkan #${channel.name}?`, {
        text: channel.postCount > 0
          ? `${channel.postCount} post di dalamnya ikut hilang dari pandangan semua orang. Isinya tidak dihapus dan channel ini dapat dipulihkan dari daftar arsip.`
          : 'Channel ini hilang dari pandangan semua orang, dan dapat dipulihkan dari daftar arsip.',
        confirmLabel: 'Arsipkan',
        danger: true,
      });
      if (!lanjut) return;
      startTransition(async () => {
        try {
          await browserClient().DELETE('/api/v1/admin/community/channels/{id}', { params: { path: { id: channel.id } } });
          // Ditandai terarsip, bukan dibuang dari daftar: kalau ia menghilang
          // dari state, jalan pulangnya ikut menghilang sampai halaman dimuat ulang.
          setChannels((current) => current.map((item) => (
            item.id === channel.id ? { ...item, archivedAt: new Date().toISOString() } : item
          )));
          if (editingId === channel.id) cancelEdit();
          setMessage(`#${channel.name} diarsipkan. Ada di daftar arsip di bawah.`);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Channel gagal diarsipkan.');
        }
      });
    })();
  }

  function restore(channel: ManagedChannel) {
    startTransition(async () => {
      try {
        const result = await browserClient().POST('/api/v1/admin/community/channels/{id}/restore', {
          params: { path: { id: channel.id } },
        });
        const dipulihkan = unwrap<ManagedChannel>(result);
        setChannels((current) => current.map((item) => (
          item.id === channel.id ? { ...item, ...dipulihkan, archivedAt: null } : item
        )));
        setMessage(`#${channel.name} dipulihkan beserta seluruh isinya.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Channel gagal dipulihkan.');
      }
    });
  }

  const aktif = channels.filter((item) => !item.archivedAt);
  const arsip = channels.filter((item) => item.archivedAt);

  return <div className="channelManager">
    <section className="card channelForm">
      <div><span className="eyebrow">CHANNEL BARU</span><h2>Buat ruang komunitas</h2><p className="communityMuted">Atur topik dan siapa yang boleh mengirim pesan.</p></div>
      <div className="field"><label htmlFor="channel-name">Nama channel</label><input id="channel-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Tanya Jawab" /></div>
      <div className="field"><label htmlFor="channel-desc">Keterangan</label><textarea id="channel-desc" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Topik yang dibahas dalam channel ini" /></div>
      <div className="field"><label htmlFor="channel-access">Yang dapat mengirim pesan</label><select id="channel-access" value={readOnly ? 'MASTER' : 'ALL'} onChange={(event) => setReadOnly(event.target.value === 'MASTER')}><option value="ALL">Master dan Pelajar</option><option value="MASTER">Hanya Master</option></select></div>
      <button className="btn" type="button" disabled={pending || name.trim().length < 2} onClick={create}>Buat channel</button>
    </section>

    <section className="channelAdminList">
      <div className="channelListHeading"><div><span className="eyebrow">RUANG KOMUNITAS</span><h2>Channel aktif</h2></div><span>{aktif.length} channel</span></div>
      {message ? <p role="status" className="communityMessage">{message}</p> : null}
      {aktif.map((item) => editingId === item.id && draft ?
        <article className="card channelEditForm" key={item.id}>
          <div className="channelEditTitle"><span className="channelHash">#</span><div><strong>Edit channel</strong><small>Perubahan langsung berlaku setelah disimpan.</small></div></div>
          <div className="channelEditGrid">
            <div className="field"><label htmlFor={`name-${item.id}`}>Nama</label><input id={`name-${item.id}`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
            <div className="field"><label htmlFor={`slug-${item.id}`}>Slug URL</label><input id={`slug-${item.id}`} value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></div>
            <div className="field channelEditDescription"><label htmlFor={`description-${item.id}`}>Keterangan</label><textarea id={`description-${item.id}`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
            <div className="field"><label htmlFor={`access-${item.id}`}>Yang dapat mengirim pesan</label><select id={`access-${item.id}`} value={draft.isReadOnly ? 'MASTER' : 'ALL'} onChange={(event) => setDraft({ ...draft, isReadOnly: event.target.value === 'MASTER' })}><option value="ALL">Master dan Pelajar</option><option value="MASTER">Hanya Master</option></select></div>
            <div className="field"><label htmlFor={`position-${item.id}`}>Urutan</label><input id={`position-${item.id}`} type="number" min="0" value={draft.position} onChange={(event) => setDraft({ ...draft, position: Number(event.target.value) })} /></div>
          </div>
          <div className="channelAdminActions"><button className="btn secondary" type="button" onClick={cancelEdit}>Batal</button><button className="btn" type="button" disabled={pending || draft.name.trim().length < 2 || draft.slug.trim().length < 2} onClick={() => save(item.id)}>Simpan perubahan</button></div>
        </article> :
        <article className="card channelAdminItem" key={item.id}>
          <span className="channelHash">#</span>
          <div><strong>{item.name}</strong><small>{item.description ?? 'Tanpa keterangan'}</small><span className="channelAccessBadge">{item.isReadOnly ? 'Hanya Master dapat mengirim' : 'Master dan Pelajar dapat mengirim'} · {item.postCount} post</span></div>
          <div className="channelAdminActions"><a className="btn secondary" href={`/community/${item.slug}`}>Buka</a><button className="btn secondary" type="button" disabled={pending} onClick={() => beginEdit(item)}>Edit</button><button className="dangerButton" type="button" disabled={pending} onClick={() => archive(item)}>Arsipkan</button></div>
        </article>)}

      {/* Daftar arsip. Tanpa ini, channel yang diarsipkan lenyap dari seluruh
          antarmuka — beserta satu-satunya jalan untuk mengembalikannya. */}
      {arsip.length > 0 ? (
        <div className="channelArchive">
          <div className="channelListHeading"><div><span className="eyebrow">ARSIP</span><h2>Channel terarsip</h2></div><span>{arsip.length} channel</span></div>
          <p className="communityMuted">Isinya tersembunyi dari semua orang, tetapi tidak dihapus. Memulihkan mengembalikannya beserta seluruh postnya.</p>
          {arsip.map((item) => (
            <article className="card channelAdminItem channelArchived" key={item.id}>
              <span className="channelHash">#</span>
              <div><strong>{item.name}</strong><small>{item.description ?? 'Tanpa keterangan'}</small><span className="channelAccessBadge">{item.postCount} post tersimpan</span></div>
              <div className="channelAdminActions"><button className="btn secondary" type="button" disabled={pending} onClick={() => restore(item)}>Pulihkan</button></div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  </div>;
}
