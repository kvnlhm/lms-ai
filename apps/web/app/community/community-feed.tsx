'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useNotifier } from '../components/notifier';
import { browserClient, unwrap, unwrapList } from '../lib/browser-api';

/** Satu tarikan pesan atau balasan; dipakai baik saat memuat lama maupun menyegarkan. */
const UKURAN_HALAMAN = 30;

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
  /** Bacaan, bukan tindakan; ikut dibawa agar kedua mode menghitungnya sama. */
  balasan: (post: CommunityPost) => CommunityComment[];
  sisaBalasan: (post: CommunityPost) => number;
  muatKomentar: (post: CommunityPost) => void;
  memuatKomentar: string | null;
};

/**
 * Menyatukan dua kumpulan pesan menjadi satu urutan kronologis, terbaru dulu.
 *
 * Dipakai baik saat memuat pesan lama maupun saat penyegaran berkala, supaya
 * pesan yang sudah ditarik pengguna tidak terbuang setiap lima detik.
 */
function gabungKronologis(lama: CommunityPost[], baru: CommunityPost[]): CommunityPost[] {
  const peta = new Map(lama.map((post) => [post.id, post]));
  for (const post of baru) peta.set(post.id, post);
  return [...peta.values()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/**
 * Menyegarkan jendela terbaru tanpa menghapus pesan lama yang sudah dimuat.
 *
 * Pesan yang seharusnya berada di dalam jendela itu tetapi tidak ikut terkirim
 * berarti sudah dihapus orang lain, jadi ia dibuang. Yang lebih tua dari
 * jendela tidak disimpulkan apa-apa: penyegaran ini tidak melihatnya.
 */
function segarkanKronologis(lama: CommunityPost[], baru: CommunityPost[], total: number): CommunityPost[] {
  if (total === 0) return [];
  const tertua = baru[baru.length - 1];
  if (!tertua) return lama;
  const batas = +new Date(tertua.createdAt);
  const terkirim = new Set(baru.map((post) => post.id));
  const bertahan = lama.filter((post) => +new Date(post.createdAt) < batas || terkirim.has(post.id));
  return gabungKronologis(bertahan, baru);
}

export function CommunityFeed({ channels, initialPosts, initialTotal, activeSlug, canModerate = false, currentUserId }: {
  channels: CommunityChannel[]; initialPosts: CommunityPost[]; initialTotal?: number; activeSlug?: string; canModerate?: boolean; currentUserId?: string;
}) {
  const notifier = useNotifier();
  const [posts, setPosts] = useState(initialPosts);
  // Jumlah seluruh tulisan menurut server; pembanding untuk tahu apakah masih
  // ada yang lebih lama. Tanpa nilai awal, anggap yang tampil sudah semuanya.
  const [total, setTotal] = useState(initialTotal ?? initialPosts.length);
  const [halaman, setHalaman] = useState(1);
  const [memuatLama, setMemuatLama] = useState(false);
  const [komentarPenuh, setKomentarPenuh] = useState<Record<string, { items: CommunityComment[]; total: number; page: number }>>({});
  const [memuatKomentar, setMemuatKomentar] = useState<string | null>(null);
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
          params: { path: { slug: activeSlug! }, query: { page: 1, pageSize: UKURAN_HALAMAN } },
        });
        const { items, meta } = unwrapList<CommunityPost>(result);
        if (!disposed) {
          setTotal(meta.total);
          setPosts((current) => segarkanKronologis(current, items, meta.total));
        }
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

  /**
   * Menarik satu halaman tulisan yang lebih lama.
   *
   * Percakapan channel hanya pernah menampilkan jendela terbarunya; lewat
   * pesan ke-31 sisanya tidak dapat dijangkau sama sekali sebelum ini.
   */
  function muatLebihLama() {
    if (memuatLama) return;
    setMemuatLama(true);
    void (async () => {
      const berikut = halaman + 1;
      try {
        const query = { page: berikut, pageSize: UKURAN_HALAMAN };
        const result = activeSlug
          ? await browserClient().GET('/api/v1/community/channels/{slug}/posts', { params: { path: { slug: activeSlug }, query } })
          : await browserClient().GET('/api/v1/community/feed', { params: { query } });
        const { items, meta } = unwrapList<CommunityPost>(result);
        setTotal(meta.total);
        setHalaman(berikut);
        setPosts((current) => (activeSlug
          ? gabungKronologis(current, items)
          // Feed memakai urutan tersemat-lalu-teraktif dari server; menyusun
          // ulang di sini justru akan melawannya.
          : [...current, ...items.filter((item) => !current.some((post) => post.id === item.id))]));
      } catch (error) {
        void notifier.error('Pesan lama gagal dimuat', { text: error instanceof Error ? error.message : undefined });
      } finally {
        setMemuatLama(false);
      }
    })();
  }

  /** Membuka seluruh balasan sebuah tulisan, atau menambah satu halaman lagi. */
  function muatKomentar(post: CommunityPost) {
    if (memuatKomentar) return;
    setMemuatKomentar(post.id);
    void (async () => {
      const dimuat = komentarPenuh[post.id];
      const berikut = (dimuat?.page ?? 0) + 1;
      try {
        const { items, meta } = unwrapList<CommunityComment>(
          await browserClient().GET('/api/v1/community/posts/{postId}/comments', {
            params: { path: { postId: post.id }, query: { page: berikut, pageSize: UKURAN_HALAMAN } },
          }),
        );
        setKomentarPenuh((current) => ({
          ...current,
          [post.id]: { items: [...(dimuat?.items ?? []), ...items], total: meta.total, page: berikut },
        }));
      } catch (error) {
        void notifier.error('Balasan gagal dimuat', { text: error instanceof Error ? error.message : undefined });
      } finally {
        setMemuatKomentar(null);
      }
    })();
  }

  function publish() {
    if (!channelId || !body.trim()) return;
    startTransition(async () => {
      try {
        const result = await browserClient().POST('/api/v1/community/channels/{channelId}/posts', { params: { path: { channelId } }, body: { body: body.trim() } });
        const created = unwrap<CommunityPost>(result);
        setPosts((current) => [created, ...current]); setTotal((current) => current + 1);
        setBody(''); setMessage(activeSlug ? 'Pesan terkirim.' : 'Post berhasil diterbitkan.');
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
        // Bila daftar penuhnya sedang terbuka, balasan baru ikut masuk ke sana
        // — kalau tidak, ia akan menghilang begitu pratinjaunya tertutup.
        setKomentarPenuh((current) => (current[postId]
          ? { ...current, [postId]: { ...current[postId], items: [...current[postId].items, created], total: current[postId].total + 1 } }
          : current));
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
        setTotal((current) => Math.max(0, current - 1));
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
        const disunting = (item: CommunityComment) => (item.id === comment.id ? { ...item, body: hasil.body, editedAt: hasil.editedAt } : item);
        setPosts((current) => current.map((post) => ({ ...post, comments: post.comments.map(disunting) })));
        setKomentarPenuh((current) => Object.fromEntries(
          Object.entries(current).map(([id, daftar]) => [id, { ...daftar, items: daftar.items.map(disunting) }]),
        ));
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
        const tanpaYangDihapus = (daftar: CommunityComment[]) => daftar.filter((item) => item.id !== comment.id);
        setPosts((current) => current.map((post) => (
          post.comments.some((item) => item.id === comment.id) || komentarPenuh[post.id]?.items.some((item) => item.id === comment.id)
            ? { ...post, comments: tanpaYangDihapus(post.comments), commentCount: Math.max(0, post.commentCount - 1) }
            : post
        )));
        setKomentarPenuh((current) => Object.fromEntries(
          Object.entries(current).map(([id, daftar]) => [id, daftar.items.some((item) => item.id === comment.id)
            ? { ...daftar, items: tanpaYangDihapus(daftar.items), total: Math.max(0, daftar.total - 1) }
            : daftar]),
        ));
      } catch (error) {
        void notifier.error('Balasan gagal dihapus', { text: error instanceof Error ? error.message : undefined });
      }
    })();
  }

  /** Balasan yang tampil: daftar penuh bila sudah dibuka, jika tidak pratinjaunya. */
  function balasan(post: CommunityPost): CommunityComment[] {
    return komentarPenuh[post.id]?.items ?? post.comments;
  }

  /** Balasan lebih lama yang masih tersembunyi di atas yang tampil. */
  function sisaBalasan(post: CommunityPost): number {
    const dimuat = komentarPenuh[post.id];
    return dimuat
      ? Math.max(0, dimuat.total - dimuat.items.length)
      : Math.max(0, post.commentCount - post.comments.length);
  }

  const aksi: AksiPesan = {
    react, suntingPost, hapusPost, suntingKomentar, hapusKomentar,
    balasan, sisaBalasan, muatKomentar, memuatKomentar,
  };

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
      adaYangLebihLama={posts.length < total}
      memuatLama={memuatLama}
      muatLebihLama={muatLebihLama}
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
              <MuatBalasan post={post} aksi={aksi} />
              {balasan(post).length > 0 ? <div className="commentList">{balasan(post).map((item) => <div className="comment" key={item.id}><Avatar person={item.author} /><p><strong>{item.author.fullName}</strong><span>{item.body}</span><Diedit at={item.editedAt} /></p><PesanAksi canEdit={item.canEdit} canDelete={item.canDelete} onEdit={() => suntingKomentar(item)} onDelete={() => hapusKomentar(item)} /></div>)}</div> : null}
              <div className="commentComposer"><span className="replyIcon" aria-hidden="true">↳</span><input value={commentDrafts[post.id] ?? ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Balas post ini…" maxLength={5000} onKeyDown={(event) => { if (event.key === 'Enter') comment(post.id); }} /><button type="button" disabled={pending || !commentDrafts[post.id]?.trim()} onClick={() => comment(post.id)}>Kirim</button></div>
            </article>
          ))}
          {posts.length === 0 ? <div className="card empty"><p>Belum ada post. Jadilah yang pertama memulai percakapan.</p></div> : null}
        </div>
        {posts.length < total ? (
          <div className="muatLagi">
            <p className="communityMuted">Menampilkan {posts.length} dari {total} post.</p>
            <button type="button" className="btnSecondary" disabled={memuatLama} onClick={muatLebihLama}>
              {memuatLama ? 'Memuat…' : 'Muat lebih banyak'}
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function ChannelChat({ posts, selected, currentUserId, body, setBody, canPost, pending, message, publish, aksi, adaYangLebihLama, memuatLama, muatLebihLama }: {
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
  adaYangLebihLama: boolean;
  memuatLama: boolean;
  muatLebihLama: () => void;
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
        {/* Di puncak, karena di sanalah percakapan yang lebih tua berada. */}
        {adaYangLebihLama ? (
          <div className="chatMuatLama">
            <button type="button" className="btnSecondary" disabled={memuatLama} onClick={muatLebihLama}>
              {memuatLama ? 'Memuat…' : 'Muat pesan lama'}
            </button>
          </div>
        ) : null}
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
              <MuatBalasan post={post} aksi={aksi} />
              {aksi.balasan(post).map((comment) => <div className={comment.author.id === currentUserId ? 'chatReply mine' : 'chatReply'} key={comment.id}>
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

/**
 * Jalan menuju balasan yang lebih lama.
 *
 * Pratinjau hanya membawa enam terakhir, sementara penghitungnya menyebut
 * jumlah penuh. Tanpa tombol ini, selisih itu adalah percakapan yang hilang.
 */
function MuatBalasan({ post, aksi }: { post: CommunityPost; aksi: AksiPesan }) {
  const sisa = aksi.sisaBalasan(post);
  if (sisa <= 0) return null;
  const sedang = aksi.memuatKomentar === post.id;
  return (
    <button type="button" className="muatBalasan" disabled={sedang} onClick={() => aksi.muatKomentar(post)}>
      {sedang ? 'Memuat balasan…' : `Lihat ${sisa} balasan sebelumnya`}
    </button>
  );
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
