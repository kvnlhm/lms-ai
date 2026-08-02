'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../../components/notifier';
import { ApiError, browserClient, unwrap, unwrapList } from '../../../lib/browser-api';

/** Bentuknya datang dari OpenAPI, jadi perubahan di API terlihat saat typecheck. */
type TopicSummary = Schemas['ForumTopicListItemDto'];

/** Sengaja lebih kecil dari batas lama: sisanya kini dapat dijangkau. */
const UKURAN_HALAMAN = 20;

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
  const notifier = useNotifier();
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [kataTermuat, setKataTermuat] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  /**
   * Halaman pertama menggantikan isi, halaman berikutnya menyambung.
   *
   * Sebelumnya lima puluh diskusi pertama diperlakukan sebagai seluruh forum,
   * sehingga percakapan yang lebih lama tidak dapat dibuka lagi — pada kursus
   * yang ramai, itu berarti sebagian besar isinya.
   */
  const load = useCallback(
    async (keyword: string, page: number) => {
      if (page === 1) setLoading(true);
      else setMemuatLagi(true);
      setError(null);
      try {
        const { items, meta } = unwrapList<TopicSummary>(
          await browserClient().GET('/api/v1/learn/courses/{courseId}/forum/topics', {
            params: {
              path: { courseId },
              query: { page, pageSize: UKURAN_HALAMAN, ...(keyword ? { search: keyword } : {}) },
            },
          }),
        );
        setTopics((current) => (page === 1 ? items : [...current, ...items]));
        setKataTermuat(keyword);
        setHalaman(meta.page);
        setTotalHalaman(meta.totalPages);
        setTotal(meta.total);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Diskusi gagal dimuat.');
      } finally {
        setLoading(false);
        setMemuatLagi(false);
      }
    },
    [courseId],
  );

  useEffect(() => {
    void load('', 1);
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
      // Kembali ke halaman pertama: diskusi baru berada di sana.
      await load(search.trim(), 1);
    } catch (caught) {
      void notifier.error('Diskusi gagal dibuat', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
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
            void load(search.trim(), 1);
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

      {!loading && halaman < totalHalaman ? (
        <div className="muatLagi">
          <p className="muted">
            Menampilkan {topics.length} dari {total} diskusi
          </p>
          <button
            className="btnSecondary"
            type="button"
            disabled={memuatLagi}
            onClick={() => void load(kataTermuat, halaman + 1)}
          >
            {memuatLagi ? 'Memuat…' : 'Muat lebih banyak'}
          </button>
        </div>
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
