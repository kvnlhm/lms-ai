'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../../components/notifier';
import { ApiError, browserClient, ensureSuccess, unwrap } from '../../../lib/browser-api';

/** Bentuknya datang dari OpenAPI, jadi perubahan di API terlihat saat typecheck. */
type Thread = Schemas['ModerationTopicThreadDto'];
type Reply = Schemas['ModerationReplyDto'];

const STATUS_LABEL: Record<Thread['status'], string> = {
  OPEN: 'Terbuka',
  RESOLVED: 'Terjawab',
  LOCKED: 'Dikunci',
  HIDDEN: 'Disembunyikan',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
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

/**
 * Satu diskusi dari mata Master.
 *
 * Halaman moderasi hanya pernah menampilkan judul, sehingga empat kewenangan
 * yang sudah lengkap di server tidak punya tempat untuk dipanggil: menjawab,
 * menandai jawaban terbaik, menghapus balasan, dan menghapus diskusi. Semuanya
 * menuntut Master melihat isi percakapannya lebih dulu, dan sampai sekarang
 * satu-satunya cara adalah membuka basis data.
 */
export function TopicModeration({ topicId }: { topicId: string }) {
  const router = useRouter();
  const notifier = useNotifier();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await browserClient().GET('/api/v1/admin/forum/topics/{topicId}', {
        params: { path: { topicId } },
      });
      setThread(unwrap(response) as Thread);
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

  if (!thread) {
    return (
      <div className="notice noticeError" role="alert">
        {error ?? 'Diskusi tidak ditemukan.'}
      </div>
    );
  }

  const setStatus = async (status: Thread['status']) => {
    let reason: string | undefined;
    if (status === 'HIDDEN') {
      const diisi = await notifier.prompt('Sembunyikan diskusi ini?', {
        text: `"${thread.title}" tidak akan terlihat pelajar. Alasannya tercatat di audit log.`,
        label: 'Alasan menyembunyikan',
        multiline: true,
        minLength: 3,
        confirmLabel: 'Sembunyikan',
        danger: true,
      });
      if (!diisi) return;
      reason = diisi;
    }
    return run(
      'status',
      () =>
        browserClient().PATCH('/api/v1/admin/forum/topics/{topicId}/status', {
          params: { path: { topicId } },
          body: { status, reason },
        }),
      `Diskusi kini ${STATUS_LABEL[status].toLowerCase()}.`,
    );
  };

  const setReplyHidden = async (reply: Reply, isHidden: boolean) => {
    let reason: string | undefined;
    if (isHidden) {
      const diisi = await notifier.prompt('Sembunyikan balasan ini?', {
        text: 'Balasannya tidak lagi terlihat pelajar. Alasannya tercatat di audit log.',
        label: 'Alasan menyembunyikan',
        multiline: true,
        minLength: 3,
        confirmLabel: 'Sembunyikan',
        danger: true,
      });
      if (!diisi) return;
      reason = diisi;
    }
    return run(
      `hidden-${reply.id}`,
      () =>
        browserClient().PATCH('/api/v1/admin/forum/replies/{replyId}/hidden', {
          params: { path: { replyId: reply.id } },
          body: { isHidden, reason },
        }),
      isHidden ? 'Balasan disembunyikan.' : 'Balasan ditampilkan kembali.',
    );
  };

  const setBestReply = (replyId: string | null) =>
    run(
      `best-${replyId ?? 'none'}`,
      () =>
        browserClient().PATCH('/api/v1/admin/forum/topics/{topicId}/best-reply', {
          params: { path: { topicId } },
          // Badan tanpa `replyId` berarti membatalkan penandaan.
          body: replyId ? { replyId } : {},
        }),
      replyId
        ? 'Jawaban terbaik ditandai, dan penulisnya diberi tahu.'
        : 'Penandaan jawaban terbaik dibatalkan.',
    );

  const hapusBalasan = async (reply: Reply) => {
    const lanjut = await notifier.confirm('Hapus balasan ini?', {
      text:
        reply.id === thread.bestReplyId
          ? 'Balasan ini sedang ditandai sebagai jawaban terbaik. Penandaannya ikut dilepas dan diskusinya kembali terbuka.'
          : 'Balasannya tidak lagi terlihat siapa pun. Menyembunyikan cukup bila hanya ingin menahannya sementara.',
      confirmLabel: 'Hapus balasan',
      danger: true,
    });
    if (!lanjut) return;
    return run(
      `delete-${reply.id}`,
      async () => {
        ensureSuccess(
          await browserClient().DELETE('/api/v1/admin/forum/replies/{replyId}', {
            params: { path: { replyId: reply.id } },
          }),
        );
      },
      'Balasan dihapus.',
    );
  };

  const hapusDiskusi = async () => {
    const lanjut = await notifier.confirm('Hapus diskusi ini?', {
      text: `"${thread.title}" beserta ${thread.replyCount} balasannya tidak lagi dapat dibuka siapa pun. Menyembunyikan cukup bila hanya ingin menahannya sementara.`,
      confirmLabel: 'Hapus diskusi',
      danger: true,
    });
    if (!lanjut) return;
    return run(
      'delete-topic',
      async () => {
        ensureSuccess(
          await browserClient().DELETE('/api/v1/admin/forum/topics/{topicId}', {
            params: { path: { topicId } },
          }),
        );
        router.push('/master/forum');
      },
      'Diskusi dihapus.',
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
          <h1 className="pageTitle">{thread.title}</h1>
          <span className="inlineActions masterForumBadges">
            {thread.isPinned ? <span className="pill pillAccent">Disematkan</span> : null}
            {thread._count.reports > 0 ? (
              <span className="pill pillAccent">{thread._count.reports} laporan</span>
            ) : null}
            <span className="pill">{STATUS_LABEL[thread.status]}</span>
          </span>
        </div>

        <div className="forumAuthor">
          <span className="forumAvatar" aria-hidden="true">
            {initials(thread.author.fullName)}
          </span>
          <span>
            <strong>{thread.author.fullName}</strong>
            <small>
              {thread.author.email} · {thread.course.title} · {formatDate(thread.createdAt)}
            </small>
          </span>
        </div>

        <p className="forumBody">{thread.body}</p>

        {thread.moderationReason ? (
          <div className="masterForumReason">
            <strong>Alasan moderasi</strong>
            <span>
              {thread.moderationReason}
              {thread.moderatedAt ? ` · ${formatDate(thread.moderatedAt)}` : null}
            </span>
          </div>
        ) : null}

        <div className="inlineActions masterForumActions">
          {thread.status !== 'HIDDEN' ? (
            <button
              className="btnTiny"
              type="button"
              disabled={busy !== null}
              onClick={() => void setStatus('HIDDEN')}
            >
              Sembunyikan
            </button>
          ) : (
            <button
              className="btnTiny"
              type="button"
              disabled={busy !== null}
              onClick={() => void setStatus('OPEN')}
            >
              Tampilkan lagi
            </button>
          )}
          <button
            className="btnTiny"
            type="button"
            disabled={busy !== null}
            onClick={() => void setStatus(thread.status === 'LOCKED' ? 'OPEN' : 'LOCKED')}
          >
            {thread.status === 'LOCKED' ? 'Buka kunci' : 'Kunci'}
          </button>
          <button
            className="btnTiny"
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void run(
                'pin',
                () =>
                  browserClient().PATCH('/api/v1/admin/forum/topics/{topicId}/pin', {
                    params: { path: { topicId } },
                    body: { isPinned: !thread.isPinned },
                  }),
                thread.isPinned ? 'Sematan dilepas.' : 'Diskusi disematkan.',
              )
            }
          >
            {thread.isPinned ? 'Lepas sematan' : 'Sematkan'}
          </button>
          <button
            className="btnGhost btnSmall"
            type="button"
            disabled={busy !== null}
            onClick={() => void hapusDiskusi()}
          >
            Hapus diskusi
          </button>
        </div>
      </article>

      <div className="forumSectionHead">
        <div>
          <span className="eyebrow">Percakapan</span>
          <h2 className="sectionTitle">{thread.replies.length} balasan</h2>
        </div>
      </div>

      {thread.replies.length === 0 ? (
        <p className="stageNote">Belum ada balasan.</p>
      ) : (
        <ul className="stack forumReplyList">
          {thread.replies.map((reply) => {
            const terbaik = reply.id === thread.bestReplyId;
            return (
              <li
                key={reply.id}
                className={[
                  'card forumReplyCard',
                  terbaik ? 'cardAccent' : '',
                  reply.isHidden ? 'forumReplyHidden' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="rowBetween">
                  <div className="forumAuthor">
                    <span className="forumAvatar forumAvatarSmall" aria-hidden="true">
                      {initials(reply.author.fullName)}
                    </span>
                    <span>
                      <strong>{reply.author.fullName}</strong>
                      <small>
                        {reply.author.email} · {formatDate(reply.createdAt)}
                      </small>
                    </span>
                  </div>
                  <span className="inlineActions masterForumBadges">
                    {reply._count.reports > 0 ? (
                      <span className="pill pillAccent">{reply._count.reports} laporan</span>
                    ) : null}
                    {terbaik ? <span className="pill pillAccent">Jawaban terbaik</span> : null}
                    {reply.isHidden ? <span className="pill">Disembunyikan</span> : null}
                  </span>
                </div>

                <p className="forumBody">{reply.body}</p>

                {reply.isHidden && reply.moderationReason ? (
                  <div className="masterForumReason">
                    <strong>Alasan moderasi</strong>
                    <span>{reply.moderationReason}</span>
                  </div>
                ) : null}

                <div className="inlineActions forumActions">
                  {terbaik ? (
                    <button
                      className="btnTiny"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void setBestReply(null)}
                    >
                      Batalkan jawaban terbaik
                    </button>
                  ) : (
                    <button
                      className="btnTiny"
                      type="button"
                      // Server menolak balasan tersembunyi sebagai jawaban
                      // terbaik, jadi tombolnya tidak ditawarkan sama sekali.
                      disabled={busy !== null || reply.isHidden}
                      onClick={() => void setBestReply(reply.id)}
                    >
                      Tandai jawaban terbaik
                    </button>
                  )}
                  <button
                    className="btnTiny"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void setReplyHidden(reply, !reply.isHidden)}
                  >
                    {reply.isHidden ? 'Tampilkan lagi' : 'Sembunyikan'}
                  </button>
                  <button
                    className="btnGhost btnSmall"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void hapusBalasan(reply)}
                  >
                    Hapus
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="card stack forumReplyComposer"
        onSubmit={(event) => {
          event.preventDefault();
          const isi = draft.trim();
          if (!isi) return;
          void run(
            'reply',
            async () => {
              await browserClient().POST('/api/v1/admin/forum/topics/{topicId}/replies', {
                params: { path: { topicId } },
                body: { body: isi },
              });
              setDraft('');
            },
            'Jawabanmu terkirim, dan penulis diskusinya diberi tahu.',
          );
        }}
      >
        <label htmlFor="jawabanMaster">
          <strong>Jawab sebagai Master</strong>
        </label>
        <textarea
          id="jawabanMaster"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          rows={5}
          maxLength={5000}
          placeholder="Jawabanmu terlihat semua peserta kursus ini."
          disabled={busy !== null}
        />
        <span className="inlineActions">
          <button
            className="btnSecondary btnSmall"
            type="submit"
            disabled={busy !== null || draft.trim().length === 0}
          >
            Kirim jawaban
          </button>
          {/* Diskusi terkunci tetap dapat dijawab Master: penguncian menahan
              pelajar, bukan yang menguncinya. */}
          {thread.status === 'LOCKED' ? (
            <small className="muted">Diskusi ini terkunci untuk pelajar.</small>
          ) : null}
        </span>
      </form>
    </section>
  );
}
