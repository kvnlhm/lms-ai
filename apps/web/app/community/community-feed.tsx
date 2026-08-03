'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { browserClient, unwrap } from '../lib/browser-api';

export type CommunityChannel = { id: string; slug: string; name: string; description: string | null; isReadOnly: boolean; postCount: number };
type Person = { id: string; fullName: string; avatarUrl: string | null };
export type CommunityComment = { id: string; body: string; createdAt: string; author: Person };
export type CommunityPost = {
  id: string; body: string; isPinned: boolean; commentCount: number; reactionCount: number;
  reactedByMe: boolean; createdAt: string; author: Person;
  channel: Pick<CommunityChannel, 'id' | 'slug' | 'name' | 'isReadOnly'>;
  comments: CommunityComment[];
};

export function CommunityFeed({ channels, initialPosts, activeSlug, canModerate = false }: {
  channels: CommunityChannel[]; initialPosts: CommunityPost[]; activeSlug?: string; canModerate?: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [channelId, setChannelId] = useState(() => channels.find((item) => item.slug === activeSlug)?.id ?? channels.find((item) => !item.isReadOnly)?.id ?? channels[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const selected = useMemo(() => channels.find((item) => item.id === channelId), [channels, channelId]);
  const canPost = selected && (!selected.isReadOnly || canModerate);

  function publish() {
    if (!channelId || !body.trim()) return;
    startTransition(async () => {
      try {
        const result = await browserClient().POST('/api/v1/community/channels/{channelId}/posts', { params: { path: { channelId } }, body: { body: body.trim() } });
        const created = unwrap<CommunityPost>(result);
        setPosts((current) => [created, ...current]); setBody(''); setMessage('Post berhasil diterbitkan.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Post gagal diterbitkan.'); }
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

  return (
    <>
      <aside className="communityChannels" aria-label="Channel komunitas">
        <Link className={!activeSlug ? 'channelLink active' : 'channelLink'} href="/">▤ <span>Feed</span></Link>
        <span className="channelGroup">Ruang komunitas</span>
        {channels.map((channel) => (
          <Link key={channel.id} className={channel.slug === activeSlug ? 'channelLink active' : 'channelLink'} href={`/community/${channel.slug}`}>
            <span>#</span><span><strong>{channel.name}</strong><small>{channel.description ?? `${channel.postCount} post`}</small></span>
          </Link>
        ))}
        {channels.length === 0 ? <p className="communityMuted">Master belum membuat channel.</p> : null}
      </aside>

      <section className="communityFeed">
        <div className="communityHeading"><div><span className="eyebrow">Komunitas</span><h1>{activeSlug ? selected?.name ?? 'Channel' : 'Feed terbaru'}</h1></div></div>
        {channels.length > 0 ? (
          <div className="postComposer card">
            <div className="composerTop"><select value={channelId} onChange={(event) => setChannelId(event.target.value)} aria-label="Pilih channel">{channels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>)}</select></div>
            {canPost ? <><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={`Bagikan sesuatu ke #${selected?.name ?? 'channel'}...`} maxLength={5000} /><div className="composerFoot"><span>{body.length}/5000</span><button className="btn" type="button" disabled={pending || !body.trim()} onClick={publish}>Terbitkan</button></div></> : <p className="communityMuted">Channel ini hanya dapat ditulis oleh Master.</p>}
          </div>
        ) : null}
        {message ? <p className="communityMessage" role="status">{message}</p> : null}
        <div className="postList">
          {posts.map((post) => (
            <article className="communityPost card" key={post.id}>
              <header><Avatar person={post.author} /><div><strong>{post.author.fullName}</strong><small>di <Link href={`/community/${post.channel.slug}`}>#{post.channel.name}</Link> · {formatDate(post.createdAt)}</small></div>{post.isPinned ? <span className="postPinned">Disematkan</span> : null}</header>
              <p className="postBody">{post.body}</p>
              <div className="postActions"><button type="button" className={post.reactedByMe ? 'reacted' : ''} onClick={() => react(post.id)}>♡ {post.reactionCount}</button><span>◯ {post.commentCount} balasan</span></div>
              {post.comments.length > 0 ? <div className="commentList">{post.comments.map((item) => <div className="comment" key={item.id}><Avatar person={item.author} /><p><strong>{item.author.fullName}</strong><span>{item.body}</span></p></div>)}</div> : null}
              <div className="commentComposer"><input value={commentDrafts[post.id] ?? ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Tulis balasan..." maxLength={5000} onKeyDown={(event) => { if (event.key === 'Enter') comment(post.id); }} /><button type="button" disabled={pending || !commentDrafts[post.id]?.trim()} onClick={() => comment(post.id)}>Kirim</button></div>
            </article>
          ))}
          {posts.length === 0 ? <div className="card empty"><p>Belum ada post. Jadilah yang pertama memulai percakapan.</p></div> : null}
        </div>
      </section>
    </>
  );
}

function Avatar({ person }: { person: Person }) { return <span className="postAvatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : person.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
