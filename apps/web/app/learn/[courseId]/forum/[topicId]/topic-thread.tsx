'use client';

import { useCallback, useEffect, useState } from 'react';
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
  currentUserId,
}: {
  topicId: string;
  currentUserId: string;
}) {
  const notifier = useNotifier();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

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
        <p className="forumBody">{topic.body}</p>
        <div className="inlineActions forumActions">
          <button
            className="btnTiny"
            type="button"
            disabled={busy !== null || !topic.canParticipate}
            onClick={() =>
              void run('react-topic', () =>
                browserClient().POST('/api/v1/learn/forum/topics/{topicId}/reactions', {
                  params: { path: { topicId } },
                }),
              )
            }
          >
            Suka ({topic._count.reactions})
          </button>
          <button
            className="btnGhost btnSmall"
            type="button"
            disabled={busy !== null}
            onClick={() => void reportContent({ topicId })}
          >
            Laporkan
          </button>
        </div>
      </article>

      <div className="forumSectionHead">
        <div>
          <span className="eyebrow">Percakapan</span>
          <h2 className="sectionTitle">{topic.replies.length} balasan</h2>
        </div>
      </div>

      <ul className="stack forumReplyList">
        {topic.replies.map((reply) => (
          <li
            key={reply.id}
            className={
              reply.id === topic.bestReplyId
                ? 'card cardAccent forumReplyCard'
                : 'card forumReplyCard'
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
              <button
                className="btnTiny"
                type="button"
                disabled={busy !== null || !topic.canParticipate}
                onClick={() =>
                  void run(`react-${reply.id}`, () =>
                    browserClient().POST('/api/v1/learn/forum/replies/{replyId}/reactions', {
                      params: { path: { replyId: reply.id } },
                    }),
                  )
                }
              >
                Suka ({reply._count.reactions})
              </button>
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
                    onClick={() =>
                      void run(
                        `delete-${reply.id}`,
                        () =>
                          browserClient()
                            .DELETE('/api/v1/learn/forum/replies/{replyId}', {
                              params: { path: { replyId: reply.id } },
                            })
                            .then(ensureSuccess),
                        'Balasan dihapus.',
                      )
                    }
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
          </li>
        ))}
      </ul>

      {topic.canParticipate ? (
        <form
          className="card stack forumReplyComposer"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              'reply',
              async () => {
                await browserClient().POST('/api/v1/learn/forum/topics/{topicId}/replies', {
                  params: { path: { topicId } },
                  body: { body: draft.trim() },
                });
                setDraft('');
              },
              'Balasan terkirim.',
            );
          }}
        >
          <div>
            <span className="eyebrow">Ikut berdiskusi</span>
            <h2 className="forumComposerTitle">Tulis balasan</h2>
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
