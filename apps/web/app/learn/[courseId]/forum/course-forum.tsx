'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';

/** Endpoint forum belum punya DTO respons di OpenAPI; bentuknya ditegaskan di sini. */
interface TopicSummary {
  id: string;
  title: string;
  status: 'OPEN' | 'RESOLVED' | 'LOCKED' | 'HIDDEN';
  isPinned: boolean;
  replyCount: number;
  lastActivityAt: string;
  author: { id: string; fullName: string; avatarUrl: string | null };
  _count: { reactions: number };
}

const STATUS_LABEL: Record<TopicSummary['status'], string> = {
  OPEN: 'Terbuka',
  RESOLVED: 'Terjawab',
  LOCKED: 'Dikunci',
  HIDDEN: 'Disembunyikan',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function CourseForum({ courseId }: { courseId: string }) {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(
    async (keyword: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await browserClient().GET(
          '/api/v1/learn/courses/{courseId}/forum/topics',
          {
            params: {
              path: { courseId },
              query: { page: 1, pageSize: 50, ...(keyword ? { search: keyword } : {}) },
            },
          },
        );
        setTopics(unwrap(response) as unknown as TopicSummary[]);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Diskusi gagal dimuat.');
      } finally {
        setLoading(false);
      }
    },
    [courseId],
  );

  useEffect(() => {
    void load('');
  }, [load]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setReasons([]);
    try {
      unwrap(
        await browserClient().POST('/api/v1/learn/courses/{courseId}/forum/topics', {
          params: { path: { courseId } },
          body: { title: title.trim(), body: body.trim() },
        }),
      );
      setTitle('');
      setBody('');
      setComposing(false);
      await load(search);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Diskusi gagal dibuat.');
      if (caught instanceof ApiError) setReasons(Object.values(caught.fields ?? {}).flat());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack forumPanel">
      <div className="forumToolbar">
        <form
          className="forumSearch"
          onSubmit={(event) => {
            event.preventDefault();
            void load(search.trim());
          }}
          role="search"
        >
          <input
            type="search"
            placeholder="Cari diskusi…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            aria-label="Cari diskusi"
          />
          <button className="btnSecondary btnSmall" type="submit" disabled={loading}>
            Cari
          </button>
        </form>
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={() => setComposing((value) => !value)}
          aria-expanded={composing}
        >
          {composing ? 'Batal' : 'Mulai diskusi'}
        </button>
      </div>

      {error ? (
        <div className="notice noticeError" role="alert">
          <p>{error}</p>
          {reasons.length > 0 ? (
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {composing ? (
        <form
          className="card stack forumComposer"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            <span>Judul</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              minLength={5}
              maxLength={200}
              required
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>Pertanyaan atau bahasan</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.currentTarget.value)}
              rows={5}
              maxLength={5000}
              required
              disabled={busy}
            />
          </label>
          <button className="btn btnBlock" type="submit" disabled={busy}>
            {busy ? 'Mengirim…' : 'Kirim diskusi'}
          </button>
        </form>
      ) : null}

      {loading ? <p className="stageNote">Memuat diskusi…</p> : null}

      {!loading && topics.length === 0 ? (
        <div className="card forumEmpty">
          <strong>Belum ada diskusi</strong>
          <p>Jadilah peserta pertama yang membuka percakapan di kursus ini.</p>
          <button className="btn" type="button" onClick={() => setComposing(true)}>
            Mulai diskusi
          </button>
        </div>
      ) : null}

      {!loading && topics.length > 0 ? (
        <ul className="stack forumTopicList">
          {topics.map((topic) => (
            <li key={topic.id} className="card forumTopicCard">
              <div className="rowBetween">
                <Link className="forumTopicLink" href={`/learn/${courseId}/forum/${topic.id}`}>
                  <span className="forumAvatar" aria-hidden="true">
                    {topic.author.avatarUrl ? (
                      <img src={topic.author.avatarUrl} alt="" />
                    ) : (
                      initials(topic.author.fullName)
                    )}
                  </span>
                  <span>
                    <strong>{topic.title}</strong>
                    <small>
                      Dibuat oleh {topic.author.fullName} · {formatDate(topic.lastActivityAt)}
                    </small>
                  </span>
                </Link>
                <span className="inlineActions">
                  {topic.isPinned ? <span className="pill pillAccent">Disematkan</span> : null}
                  <span className="pill">{STATUS_LABEL[topic.status]}</span>
                </span>
              </div>
              <div className="forumTopicStats" aria-label="Aktivitas diskusi">
                <span><strong>{topic.replyCount}</strong> balasan</span>
                <span><strong>{topic._count.reactions}</strong> suka</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
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
