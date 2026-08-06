'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../../../components/notifier';
import { ApiError, browserClient, ensureSuccess, unwrap } from '../../../../lib/browser-api';

/** Bentuknya datang dari OpenAPI, jadi perubahan di API terlihat saat typecheck. */
type TopicDetail = Schemas['ForumTopicDetailDto'];

const STATUS_LABEL: Record<TopicDetail['status'], string> = {
  OPEN: 'Terbuka',
  RESOLVED: 'Terjawab',
  LOCKED: 'Dikunci',
  HIDDEN: 'Disembunyikan',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function TopicThread({
  topicId,
  courseId,
  currentUserId,
}: {
  topicId: string;
  courseId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const notifier = useNotifier();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicTitleDraft, setTopicTitleDraft] = useState('');
  const [topicBodyDraft, setTopicBodyDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await browserClient().GET('/api/v1/learn/forum/topics/{topicId}', {
        params: { path: { topicId } },
      });
      setTopic(unwrap(response) as TopicDetail);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Diskusi tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: string, task: () => Promise<unknown>, success?: string) {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      await task();
      if (success) notifier.success(success);
      await load();
    } catch (caught) {
      void notifier.error('Tindakan gagal dijalankan', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="stageNote">Memuat diskusi…</p>;

  if (!topic) {
    return (
      <div className="notice noticeError" role="alert">
        {error ?? 'Diskusi tidak ditemukan.'}
      </div>
    );
  }

  const reportContent = async (target: { topicId?: string; replyId?: string }) => {
    // Batas 5 karakter dijaga di dalam dialog. Sebelumnya laporan yang terlalu
    // pendek dibuang diam-diam: dialognya tertutup dan tidak ada yang terjadi,
    // sehingga pelapor mengira laporannya terkirim.
    const reason = await notifier.prompt('Laporkan konten ini?', {
      text: 'Laporan dibaca Master beserta tautan ke konten yang kamu laporkan.',
      label: 'Apa yang perlu Master ketahui?',
      multiline: true,
      minLength: 5,
      confirmLabel: 'Kirim laporan',
    });
    if (!reason) return;
    return run(
      'report',
      () => browserClient().POST('/api/v1/learn/forum/reports', { body: { ...target, reason } }),
      'Laporan terkirim ke Master.',
    );
  };

  const visibleReplyIds = new Set(topic.replies.map((reply) => reply.id));
  const rootReplies = topic.replies.filter((reply) => !reply.parentReplyId || !visibleReplyIds.has(reply.parentReplyId));
  const childReplies = new Map(rootReplies.map((reply) => [
    reply.id,
    topic.replies.filter((child) => child.parentReplyId === reply.id),
  ]));
  const visibleReplies = rootReplies.flatMap((reply) => [
    reply,
    ...(expandedReplies.has(reply.id) ? childReplies.get(reply.id) ?? [] : []),
  ]);

  return (
    <section className="stack forumThread">
      {error ? (
        <div className="notice noticeError" role="alert">
          {error}
        </div>
      ) : null}

      <article className="card stack forumTopicHero">
        <div className="rowBetween">
          <h1 className="pageTitle">{topic.title}</h1>
          <span className="inlineActions">
            {topic.isPinned ? <span className="pill pillAccent">Disematkan</span> : null}
            <span className="pill">{STATUS_LABEL[topic.status]}</span>
          </span>
        </div>
        <div className="forumAuthor">
          <span className="forumAvatar" aria-hidden="true">
            {topic.author.avatarUrl ? (
              <img src={topic.author.avatarUrl} alt="" />
            ) : (
              initials(topic.author.fullName)
            )}
          </span>
          <span>
            <strong>{topic.author.fullName}</strong>
            <small>{formatDate(topic.createdAt)}</small>
          </span>
        </div>
        {editingTopic ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                'edit-topic',
                async () => {
                  await browserClient().PATCH('/api/v1/learn/forum/topics/{topicId}', {
                    params: { path: { topicId } },
                    body: { title: topicTitleDraft.trim(), body: topicBodyDraft.trim() },
                  });
                  setEditingTopic(false);
                },
                'Diskusi diperbarui.',
              );
            }}
          >
            <label className="field">
              <span>Judul</span>
              <input
                value={topicTitleDraft}
                onChange={(event) => setTopicTitleDraft(event.currentTarget.value)}
                minLength={5}
                maxLength={200}
                required
                disabled={busy !== null}
              />
            </label>
            <label className="field">
              <span>Isi</span>
              <textarea
                value={topicBodyDraft}
                onChange={(event) => setTopicBodyDraft(event.currentTarget.value)}
                rows={5}
                maxLength={5000}
                required
                disabled={busy !== null}
              />
            </label>
            <span className="inlineActions">
              <button className="btnSecondary btnSmall" type="submit" disabled={busy !== null}>
                Simpan
              </button>
              <button
                className="btnGhost btnSmall"
                type="button"
                disabled={busy !== null}
                onClick={() => setEditingTopic(false)}
              >
                Batal
              </button>
            </span>
          </form>
        ) : (
          <p className="forumBody">{topic.body}</p>
        )}
        <div className="inlineActions forumActions">
          <SukaButton
            aktif={topic.reactedByMe}
            jumlah={topic._count.reactions}
            disabled={busy !== null || !topic.canParticipate}
            onClick={() =>
              void run('react-topic', () =>
                browserClient().POST('/api/v1/learn/forum/topics/{topicId}/reactions', {
                  params: { path: { topicId } },
                }),
              )
            }
          />
          {/* API sudah lama menerima sunting dan hapus topik sendiri; halaman
              ini tidak pernah menawarkannya, jadi salah ketik pada judul
              diskusi sendiri tidak dapat diperbaiki selamanya. */}
          {topic.canManage && !editingTopic ? (
            <>
              <button
                className="btnTiny"
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setTopicTitleDraft(topic.title);
                  setTopicBodyDraft(topic.body);
                  setEditingTopic(true);
                }}
              >
                Sunting
              </button>
              <button
                className="btnGhost btnSmall"
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  const lanjut = await notifier.confirm('Hapus diskusi ini?', {
                    text: 'Balasan orang lain tetap tersimpan di riwayat, tetapi diskusinya tidak lagi dapat dibuka.',
                    confirmLabel: 'Hapus diskusi',
                    danger: true,
                  });
                  if (!lanjut) return;
                  void run(
                    'delete-topic',
                    async () => {
                      ensureSuccess(
                        await browserClient().DELETE('/api/v1/learn/forum/topics/{topicId}', {
                          params: { path: { topicId } },
                        }),
                      );
                      router.push(`/learn/${courseId}/forum`);
                    },
                    'Diskusi dihapus.',
                  );
                }}
              >
                Hapus
              </button>
            </>
          ) : null}
          {topic.author.id !== currentUserId ? (
            <button
              className="btnGhost btnSmall"
              type="button"
              disabled={busy !== null}
              onClick={() => void reportContent({ topicId })}
            >
              Laporkan
            </button>
          ) : null}
        </div>
      </article>

      <div className="forumSectionHead">
        <div>
          <span className="eyebrow">Percakapan</span>
          <h2 className="sectionTitle">{topic.replies.length} balasan</h2>
        </div>
      </div>

      <ul className="stack forumReplyList">
        {visibleReplies.map((reply) => (
          <li
            key={reply.id}
            className={
              reply.id === topic.bestReplyId
                ? `card cardAccent forumReplyCard${reply.parentReplyId ? ' forumReplyNested' : ''}`
                : `card forumReplyCard${reply.parentReplyId ? ' forumReplyNested' : ''}`
            }
          >
            <div className="rowBetween">
              <div className="forumAuthor">
                <span className="forumAvatar forumAvatarSmall" aria-hidden="true">
                  {reply.author.avatarUrl ? (
                    <img src={reply.author.avatarUrl} alt="" />
                  ) : (
                    initials(reply.author.fullName)
                  )}
                </span>
                <span>
                  <strong>{reply.author.fullName}</strong>
                  <small>{formatDate(reply.createdAt)}</small>
                  {reply.parentAuthor ? <small className="forumReplyingTo">Membalas @{reply.parentAuthor.fullName}</small> : null}
                </span>
              </div>
              {reply.id === topic.bestReplyId ? (
                <span className="pill pillAccent">Jawaban terbaik</span>
              ) : null}
            </div>

            {editingId === reply.id ? (
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    `edit-${reply.id}`,
                    async () => {
                      await browserClient().PATCH('/api/v1/learn/forum/replies/{replyId}', {
                        params: { path: { replyId: reply.id } },
                        body: { body: editDraft.trim() },
                      });
                      setEditingId(null);
                    },
                    'Balasan diperbarui.',
                  );
                }}
              >
                <textarea
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.currentTarget.value)}
                  rows={4}
                  maxLength={5000}
                  required
                  disabled={busy !== null}
                />
                <span className="inlineActions">
                  <button className="btnSecondary btnSmall" type="submit" disabled={busy !== null}>
                    Simpan
                  </button>
                  <button
                    className="btnGhost btnSmall"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setEditingId(null)}
                  >
                    Batal
                  </button>
                </span>
              </form>
            ) : (
              <p className="forumBody">{reply.body}</p>
            )}

            <div className="inlineActions forumActions">
              <SukaButton
                aktif={reply.reactedByMe}
                jumlah={reply._count.reactions}
                disabled={busy !== null || !topic.canParticipate}
                onClick={() =>
                  void run(`react-${reply.id}`, () =>
                    browserClient().POST('/api/v1/learn/forum/replies/{replyId}/reactions', {
                      params: { path: { replyId: reply.id } },
                    }),
                  )
                }
              />
              {!reply.parentReplyId && topic.canParticipate ? (
                <button
                  className="btnTiny"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setReplyTarget({ id: reply.id, name: reply.author.fullName });
                    document.getElementById('forum-reply-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  Balas
                </button>
              ) : null}
              {reply.author.id === currentUserId && editingId !== reply.id ? (
                <>
                  <button
                    className="btnTiny"
                    type="button"
                    disabled={busy !== null || !topic.canParticipate}
                    onClick={() => {
                      setEditDraft(reply.body);
                      setEditingId(reply.id);
                    }}
                  >
                    Sunting
                  </button>
                  <button
                    className="btnGhost btnSmall"
                    type="button"
                    disabled={busy !== null}
                    // Satu-satunya penghapusan di aplikasi ini yang dulu
                    // berjalan tanpa konfirmasi, padahal sama tidak dapat
                    // dibatalkannya dengan yang lain.
                    onClick={async () => {
                      const lanjut = await notifier.confirm('Hapus balasan ini?', {
                        text: 'Balasan yang dihapus tidak dapat dikembalikan.',
                        confirmLabel: 'Hapus balasan',
                        danger: true,
                      });
                      if (!lanjut) return;
                      void run(
                        `delete-${reply.id}`,
                        () =>
                          browserClient()
                            .DELETE('/api/v1/learn/forum/replies/{replyId}', {
                              params: { path: { replyId: reply.id } },
                            })
                            .then(ensureSuccess),
                        'Balasan dihapus.',
                      );
                    }}
                  >
                    Hapus
                  </button>
                </>
              ) : null}
              {reply.author.id !== currentUserId ? (
                <button
                  className="btnGhost btnSmall"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void reportContent({ replyId: reply.id })}
                >
                  Laporkan
                </button>
              ) : null}
            </div>
            {!reply.parentReplyId && (childReplies.get(reply.id)?.length ?? 0) > 0 ? (
              <button
                className="forumChildrenToggle"
                type="button"
                aria-expanded={expandedReplies.has(reply.id)}
                onClick={() => setExpandedReplies((current) => {
                  const next = new Set(current);
                  if (next.has(reply.id)) next.delete(reply.id); else next.add(reply.id);
                  return next;
                })}
              >
                {expandedReplies.has(reply.id) ? 'Sembunyikan balasan' : `Lihat ${childReplies.get(reply.id)!.length} balasan`}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {topic.canParticipate ? (
        <form
          id="forum-reply-composer"
          className="card stack forumReplyComposer"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              'reply',
              async () => {
                await browserClient().POST('/api/v1/learn/forum/topics/{topicId}/replies', {
                  params: { path: { topicId } },
                  body: { body: draft.trim(), ...(replyTarget ? { parentReplyId: replyTarget.id } : {}) },
                });
                setDraft('');
                setReplyTarget(null);
              },
              'Balasan terkirim.',
            );
          }}
        >
          <div>
            <span className="eyebrow">Ikut berdiskusi</span>
            <h2 className="forumComposerTitle">Tulis balasan</h2>
            {replyTarget ? <p className="forumReplyTarget">Membalas @{replyTarget.name} <button type="button" onClick={() => setReplyTarget(null)}>Batal</button></p> : null}
          </div>
          <label className="field forumReplyField">
            <span className="srOnly">Isi balasan</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              rows={4}
              maxLength={5000}
              required
              disabled={busy !== null}
              placeholder="Tulis pendapat, pertanyaan, atau jawabanmu…"
            />
          </label>
          <button className="btn btnBlock" type="submit" disabled={busy !== null}>
            {busy === 'reply' ? 'Mengirim…' : 'Kirim balasan'}
          </button>
        </form>
      ) : (
        <div className="notice" role="status">
          {topic.participationBlockedReason
            ? `Hak berdiskusimu sedang dicabut. Alasan: ${topic.participationBlockedReason}`
            : 'Diskusi ini dikunci Master, jadi balasan baru tidak diterima.'}
        </div>
      )}
    </section>
  );
}

/**
 * Saklar suka yang menunjukkan keadaannya sendiri.
 *
 * Endpointnya menyalakan dan mematikan reaksi, tetapi tombolnya dulu hanya
 * menampilkan angka. Setelah halaman dimuat ulang, pengguna tidak punya cara
 * mengetahui apakah dirinya termasuk di antara yang menyukainya.
 */
function SukaButton({
  aktif,
  jumlah,
  disabled,
  onClick,
}: {
  aktif: boolean;
  jumlah: number;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={aktif ? 'btnTiny btnActive' : 'btnTiny'}
      type="button"
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
    >
      {aktif ? 'Disukai' : 'Suka'} ({jumlah})
    </button>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
