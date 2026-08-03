'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useNotifier } from '../components/notifier';
import { browserClient, unwrap } from '../lib/browser-api';

export type CommunityChannel = { id: string; slug: string; name: string; description: string | null; isReadOnly: boolean; postCount: number };
type Person = { id: string; fullName: string; avatarUrl: string | null };
export type CommunityComment = {
  id: string; body: string; editedAt: string | null; createdAt: string; author: Person;
  canEdit: boolean; canDelete: boolean;
};
export type CommunityPost = {
  id: string; body: string; isPinned: boolean; commentCount: number; reactionCount: number;
  reactedByMe: boolean; editedAt: string | null; createdAt: string; author: Person;
  canEdit: boolean; canDelete: boolean;
  channel: Pick<CommunityChannel, 'id' | 'slug' | 'name' | 'isReadOnly'>;
  comments: CommunityComment[];
};

/** Tindakan atas sebuah tulisan; dibawa utuh agar mode chat dan feed sama persis. */
type AksiPesan = {
  react: (postId: string) => void;
  suntingPost: (post: CommunityPost) => void;
  hapusPost: (post: CommunityPost) => void;
  suntingKomentar: (comment: CommunityComment) => void;
  hapusKomentar: (comment: CommunityComment) => void;
};

export function CommunityFeed({ channels, initialPosts, activeSlug, canModerate = false, currentUserId }: {
  channels: CommunityChannel[]; initialPosts: CommunityPost[]; activeSlug?: string; canModerate?: boolean; currentUserId?: string;
}) {
  const notifier = useNotifier();
  const [posts, setPosts] = useState(initialPosts);
  const [channelId, setChannelId] = useState(() => channels.find((item) => item.slug === activeSlug)?.id ?? channels.find((item) => !item.isReadOnly)?.id ?? channels[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const refreshing = useRef(false);
  const selected = useMemo(() => channels.find((item) => item.id === channelId), [channels, channelId]);
  const canPost = selected && (!selected.isReadOnly || canModerate);

  useEffect(() => {
    if (!activeSlug) return;
    let disposed = false;
    async function refresh() {
      if (refreshing.current || document.visibilityState === 'hidden') return;
      refreshing.current = true;
      try {
        const result = await browserClient().GET('/api/v1/community/channels/{slug}/posts', {
          params: { path: { slug: activeSlug! }, query: { page: 1, pageSize: 50 } },
        });
        const latest = unwrap<CommunityPost[]>(result);
        if (!disposed) setPosts(latest);
      } catch {
        // Kegagalan refresh sementara tidak menghapus pesan yang sudah tampil.
      } finally {
        refreshing.current = false;
      }
    }
    const timer = window.setInterval(refresh, 5_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [activeSlug]);

  function publish() {
    if (!channelId || !body.trim()) return;
    startTransition(async () => {
      try {
        const result = await browserClient().POST('/api/v1/community/channels/{channelId}/posts', { params: { path: { channelId } }, body: { body: body.trim() } });
        const created = unwrap<CommunityPost>(result);
        setPosts((current) => [created, ...current]); setBody(''); setMessage(activeSlug ? 'Pesan terkirim.' : 'Post berhasil diterbitkan.');
      } catch (error) { setMessage(error instanceof Error ? error.message : activeSlug ? 'Pesan gagal dikirim.' : 'Post gagal diterbitkan.'); }
    });
  }

  function react(postId: string) {
    startTransition(async () => {
      try {
        const result = await browserClient().POST('/api/v1/community/posts/{postId}/reaction', { params: { path: { postId } } });
        const value = unwrap<{ reacted: boolean; reactionCount: number }>(result);
        setPosts((current) => current.map((post) => post.id === postId ? { ...post, ...value } : post));
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Reaksi gagal disimpan.'); }
    });
  }

  function comment(postId: string) {
    const draft = commentDrafts[postId]?.trim(); if (!draft) return;
    startTransition(async () => {
      try {
        const result = await browserClient().POST('/api/v1/community/posts/{postId}/comments', { params: { path: { postId } }, body: { body: draft } });
        const created = unwrap<CommunityComment>(result);
        setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: [...post.comments, created], commentCount: post.commentCount + 1 } : post));
        setCommentDrafts((current) => ({ ...current, [postId]: '' }));
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Balasan gagal dikirim.'); }
    });
  }

  /** Menempatkan kembali satu post yang berubah, tanpa memuat ulang seluruh daftar. */
  function gantiPost(postId: string, ubah: (post: CommunityPost) => CommunityPost) {
    setPosts((current) => current.map((post) => (post.id === postId ? ubah(post) : post)));
  }

  function suntingPost(post: CommunityPost) {
    void (async () => {
      const baru = await notifier.prompt('Ubah tulisan', {
        label: 'Tulisanmu', defaultValue: post.body, multiline: true, minLength: 1,
        confirmLabel: 'Simpan perubahan',
      });
      // `null` berarti dibatalkan; teks yang sama persis tidak perlu dikirim.
      if (baru === null || baru === post.body) return;
      try {
        const hasil = unwrap<CommunityPost>(
          await browserClient().PATCH('/api/v1/community/posts/{postId}', {
            params: { path: { postId: post.id } }, body: { body: baru },
          }),
        );
        gantiPost(post.id, (lama) => ({ ...lama, body: hasil.body, editedAt: hasil.editedAt }));
      } catch (error) {
        void notifier.error('Perubahan tidak tersimpan', { text: error instanceof Error ? error.message : undefined });
      }
    })();
  }

  function hapusPost(post: CommunityPost) {
    void (async () => {
      const milikSendiri = post.author.id === currentUserId;
      const lanjut = await notifier.confirm(
        milikSendiri ? 'Hapus tulisanmu?' : `Hapus tulisan ${post.author.fullName}?`,
        {
          text: milikSendiri
            ? 'Tulisan ini hilang dari channel dan tidak dapat dikembalikan.'
            : 'Tulisan ini hilang dari channel, dan penghapusannya tercatat di audit log beserta isi aslinya.',
          confirmLabel: 'Hapus', danger: true,
        },
      );
      if (!lanjut) return;
      try {
        unwrap(await browserClient().DELETE('/api/v1/community/posts/{postId}', { params: { path: { postId: post.id } } }));
        setPosts((current) => current.filter((item) => item.id !== post.id));
      } catch (error) {
        void notifier.error('Tulisan gagal dihapus', { text: error instanceof Error ? error.message : undefined });
      }
    })();
  }

  function suntingKomentar(comment: CommunityComment) {
    void (async () => {
      const baru = await notifier.prompt('Ubah balasan', {
        label: 'Balasanmu', defaultValue: comment.body, multiline: true, minLength: 1,
        confirmLabel: 'Simpan perubahan',
      });
      if (baru === null || baru === comment.body) return;
      try {
        const hasil = unwrap<CommunityComment>(
          await browserClient().PATCH('/api/v1/community/comments/{commentId}', {
            params: { path: { commentId: comment.id } }, body: { body: baru },
          }),
        );
        setPosts((current) => current.map((post) => ({
          ...post,
          comments: post.comments.map((item) => (item.id === comment.id ? { ...item, body: hasil.body, editedAt: hasil.editedAt } : item)),
        })));
      } catch (error) {
        void notifier.error('Perubahan tidak tersimpan', { text: error instanceof Error ? error.message : undefined });
      }
    })();
  }

  function hapusKomentar(comment: CommunityComment) {
    void (async () => {
      const milikSendiri = comment.author.id === currentUserId;
      const lanjut = await notifier.confirm(
        milikSendiri ? 'Hapus balasanmu?' : `Hapus balasan ${comment.author.fullName}?`,
        {
          text: milikSendiri
            ? 'Balasan ini hilang dan tidak dapat dikembalikan.'
            : 'Balasan ini hilang, dan penghapusannya tercatat di audit log beserta isi aslinya.',
          confirmLabel: 'Hapus', danger: true,
        },
      );
      if (!lanjut) return;
      try {
        unwrap(await browserClient().DELETE('/api/v1/community/comments/{commentId}', { params: { path: { commentId: comment.id } } }));
        setPosts((current) => current.map((post) => (
          post.comments.some((item) => item.id === comment.id)
            ? { ...post, comments: post.comments.filter((item) => item.id !== comment.id), commentCount: Math.max(0, post.commentCount - 1) }
            : post
        )));
      } catch (error) {
        void notifier.error('Balasan gagal dihapus', { text: error instanceof Error ? error.message : undefined });
      }
    })();
  }

  const aksi: AksiPesan = { react, suntingPost, hapusPost, suntingKomentar, hapusKomentar };

  if (activeSlug) {
    return <ChannelChat
      posts={posts}
      selected={selected}
      currentUserId={currentUserId}
      body={body}
      setBody={setBody}
      canPost={Boolean(canPost)}
      pending={pending}
      message={message}
      publish={publish}
      aksi={aksi}
    />;
  }

  return (
    <>
      <section className="communityFeed">
        <div className="communityHeading"><div><span className="eyebrow">Komunitas</span><h1>{activeSlug ? selected?.name ?? 'Channel' : 'Feed terbaru'}</h1></div></div>
        {channels.length > 0 ? (
          <div className="postComposer card">
            <div className="composerChannelPicker" role="group" aria-label="Pilih channel tujuan">{channels.map((channel) => <button key={channel.id} className={channel.id === channelId ? 'active' : ''} type="button" onClick={() => setChannelId(channel.id)}># {channel.name}</button>)}</div>
            {canPost ? <><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={`Bagikan sesuatu ke #${selected?.name ?? 'channel'}...`} maxLength={5000} /><div className="composerFoot"><span>{body.length}/5000</span><button className="btn" type="button" disabled={pending || !body.trim()} onClick={publish}>Terbitkan</button></div></> : <p className="communityMuted">Channel ini hanya dapat ditulis oleh Master.</p>}
          </div>
        ) : null}
        {message ? <p className="communityMessage" role="status">{message}</p> : null}
        <div className="postList">
          {posts.map((post) => (
            <article className="communityPost card" key={post.id}>
              <header><Avatar person={post.author} /><div><strong>{post.author.fullName}</strong><small>di <Link href={`/community/${post.channel.slug}`}>#{post.channel.name}</Link> · {formatDate(post.createdAt)}</small></div>{post.isPinned ? <span className="postPinned">Disematkan</span> : null}</header>
              <p className="postBody">{post.body}<Diedit at={post.editedAt} /></p>
              <div className="postActions"><button type="button" className={post.reactedByMe ? 'reacted' : ''} onClick={() => react(post.id)}>♡ {post.reactionCount}</button><span>◯ {post.commentCount} balasan</span><PesanAksi canEdit={post.canEdit} canDelete={post.canDelete} onEdit={() => suntingPost(post)} onDelete={() => hapusPost(post)} /></div>
              {post.comments.length > 0 ? <div className="commentList">{post.comments.map((item) => <div className="comment" key={item.id}><Avatar person={item.author} /><p><strong>{item.author.fullName}</strong><span>{item.body}</span><Diedit at={item.editedAt} /></p><PesanAksi canEdit={item.canEdit} canDelete={item.canDelete} onEdit={() => suntingKomentar(item)} onDelete={() => hapusKomentar(item)} /></div>)}</div> : null}
              <div className="commentComposer"><span className="replyIcon" aria-hidden="true">↳</span><input value={commentDrafts[post.id] ?? ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Balas post ini…" maxLength={5000} onKeyDown={(event) => { if (event.key === 'Enter') comment(post.id); }} /><button type="button" disabled={pending || !commentDrafts[post.id]?.trim()} onClick={() => comment(post.id)}>Kirim</button></div>
            </article>
          ))}
          {posts.length === 0 ? <div className="card empty"><p>Belum ada post. Jadilah yang pertama memulai percakapan.</p></div> : null}
        </div>
      </section>
    </>
  );
}

function ChannelChat({ posts, selected, currentUserId, body, setBody, canPost, pending, message, publish, aksi }: {
  posts: CommunityPost[];
  selected?: CommunityChannel;
  currentUserId?: string;
  body: string;
  setBody: (value: string) => void;
  canPost: boolean;
  pending: boolean;
  message: string;
  publish: () => void;
  aksi: AksiPesan;
}) {
  const timeline = useMemo(() => [...posts].reverse(), [posts]);

  return <>
    <section className="communityFeed channelChat" aria-label={`Percakapan ${selected?.name ?? 'channel'}`}>
      <header className="chatHeader">
        <span className="chatHash" aria-hidden="true">#</span>
        <div><h1>{selected?.name ?? 'Channel'}</h1><p>{selected?.description ?? 'Ruang percakapan komunitas'}</p></div>
        <span className="liveBadge"><i /> Diperbarui otomatis</span>
      </header>

      <div className="chatTimeline" aria-live="polite" aria-relevant="additions">
        {timeline.length === 0 ? <div className="chatEmpty"><span>#</span><h2>Selamat datang di #{selected?.name}</h2><p>Belum ada pesan. Mulai percakapan pertama di channel ini.</p></div> : null}
        {timeline.map((post) => {
          const mine = post.author.id === currentUserId;
          return <div className={mine ? 'chatMessage mine' : 'chatMessage'} key={post.id}>
            {!mine ? <Avatar person={post.author} /> : null}
            <div className="chatMessageContent">
              <div className="chatMeta"><strong>{mine ? 'Kamu' : post.author.fullName}</strong><time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></div>
              <div className="chatBubble"><p>{post.body}<Diedit at={post.editedAt} /></p></div>
              <div className="chatMessageActions">
                <button type="button" className={post.reactedByMe ? 'chatReaction reacted' : 'chatReaction'} onClick={() => aksi.react(post.id)} aria-label={`Beri reaksi pada pesan ${post.author.fullName}`}>♡ {post.reactionCount || ''}</button>
                <PesanAksi canEdit={post.canEdit} canDelete={post.canDelete} onEdit={() => aksi.suntingPost(post)} onDelete={() => aksi.hapusPost(post)} />
              </div>
              {post.comments.map((comment) => <div className={comment.author.id === currentUserId ? 'chatReply mine' : 'chatReply'} key={comment.id}>
                <strong>{comment.author.id === currentUserId ? 'Kamu' : comment.author.fullName}</strong><span>{comment.body}</span><Diedit at={comment.editedAt} />
                <PesanAksi canEdit={comment.canEdit} canDelete={comment.canDelete} onEdit={() => aksi.suntingKomentar(comment)} onDelete={() => aksi.hapusKomentar(comment)} />
              </div>)}
            </div>
            {mine ? <Avatar person={post.author} /> : null}
          </div>;
        })}
      </div>

      <div className="chatComposerWrap">
        {message ? <p className="chatStatus" role="status">{message}</p> : null}
        {canPost ? <div className="chatComposer">
          <textarea
            aria-label={`Kirim pesan ke ${selected?.name ?? 'channel'}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={`Kirim pesan ke #${selected?.name ?? 'channel'}`}
            maxLength={5000}
            rows={1}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); publish(); } }}
          />
          <span className="chatHint">Shift + Enter untuk baris baru</span>
          <button className="chatSend" type="button" disabled={pending || !body.trim()} onClick={publish} aria-label="Kirim pesan">➤</button>
        </div> : <p className="chatReadOnly">Channel ini hanya dapat ditulis oleh Master.</p>}
      </div>
    </section>
  </>;
}

/**
 * Penanda bahwa sebuah tulisan pernah diubah.
 *
 * Tanpa ini, menyunting berarti mengganti apa yang sudah dibaca orang lain
 * tanpa jejak — dan itu membuat percakapan tidak dapat dipercaya.
 */
function Diedit({ at }: { at: string | null }) {
  if (!at) return null;
  return <em className="editedMark" title={`Diubah ${formatDate(at)}`}>diedit</em>;
}

/** Sunting dan hapus, hanya sejauh yang diizinkan server pada tulisan ini. */
function PesanAksi({ canEdit, canDelete, onEdit, onDelete }: {
  canEdit: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void;
}) {
  if (!canEdit && !canDelete) return null;
  return <span className="messageActions">
    {canEdit ? <button type="button" onClick={onEdit}>Sunting</button> : null}
    {canDelete ? <button type="button" className="messageDanger" onClick={onDelete}>Hapus</button> : null}
  </span>;
}

function Avatar({ person }: { person: Person }) { return <span className="postAvatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : person.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
