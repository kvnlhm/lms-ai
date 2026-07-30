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
    <section className="stack">
      <div className="rowBetween">
        <form
          className="inlineActions"
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
          className="card stack"
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
        <p className="stageNote">
          Belum ada diskusi di kursus ini. Jadilah yang pertama bertanya.
        </p>
      ) : null}

      {!loading && topics.length > 0 ? (
        <ul className="stack">
          {topics.map((topic) => (
            <li key={topic.id} className="card">
              <div className="rowBetween">
                <Link href={`/learn/${courseId}/forum/${topic.id}`}>
                  <strong>{topic.title}</strong>
                </Link>
                <span className="inlineActions">
                  {topic.isPinned ? <span className="pill pillAccent">Disematkan</span> : null}
                  <span className="pill">{STATUS_LABEL[topic.status]}</span>
                </span>
              </div>
              <small className="muted">
                {topic.author.fullName} · {topic.replyCount} balasan · {topic._count.reactions}{' '}
                reaksi · {formatDate(topic.lastActivityAt)}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
