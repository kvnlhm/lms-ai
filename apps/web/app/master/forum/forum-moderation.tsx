'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';

/**
 * Bentuknya datang dari OpenAPI.
 *
 * Deklarasi sebelumnya mengklaim `author.email` dan `reporter.email`, padahal
 * `authorSelect` di server hanya mengirim id, nama, dan foto. Cast buta membuat
 * TypeScript menerima klaim itu tanpa pernah memeriksanya.
 */
type ModerationTopic = Schemas['ModerationTopicListItemDto'];
type Report = Schemas['ForumReportListItemDto'];
type Ban = Schemas['ForumBanDto'];

const STATUS_LABEL: Record<ModerationTopic['status'], string> = {
  OPEN: 'Terbuka',
  RESOLVED: 'Selesai',
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

export function ForumModeration() {
  const [tab, setTab] = useState<'topics' | 'reports' | 'bans'>('topics');
  const [topics, setTopics] = useState<ModerationTopic[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = browserClient();
      const [topicsResponse, reportsResponse, bansResponse] = await Promise.all([
        client.GET('/api/v1/admin/forum/topics', { params: { query: { page: 1, pageSize: 50 } } }),
        client.GET('/api/v1/admin/forum/reports', {
          params: { query: { status: 'PENDING', page: 1, pageSize: 50 } },
        }),
        client.GET('/api/v1/admin/forum/bans', { params: { query: { activeOnly: true } } }),
      ]);
      setTopics(unwrap(topicsResponse) as ModerationTopic[]);
      setReports(unwrap(reportsResponse) as Report[]);
      setBans(unwrap(bansResponse) as Ban[]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Data forum gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: string, task: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      await task();
      setNotice(success);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Tindakan gagal dijalankan.');
    } finally {
      setBusy(null);
    }
  }

  const setStatus = (topic: ModerationTopic, status: ModerationTopic['status']) => {
    const reason =
      status === 'HIDDEN'
        ? window.prompt('Alasan menyembunyikan diskusi ini?')?.trim()
        : undefined;
    if (status === 'HIDDEN' && !reason) return;
    return run(
      `status-${topic.id}`,
      () =>
        browserClient().PATCH('/api/v1/admin/forum/topics/{topicId}/status', {
          params: { path: { topicId: topic.id } },
          body: { status, reason },
        }),
      `Diskusi "${topic.title}" kini ${STATUS_LABEL[status].toLowerCase()}.`,
    );
  };

  const banUser = (topic: ModerationTopic, scope: 'course' | 'global') => {
    const reason = window.prompt(
      `Alasan mencabut hak berdiskusi ${topic.author.fullName}?`,
    )?.trim();
    if (!reason) return;
    return run(
      `ban-${topic.id}`,
      () =>
        browserClient().POST('/api/v1/admin/forum/bans', {
          body: {
            userId: topic.author.id,
            courseId: scope === 'course' ? topic.course.id : undefined,
            reason,
          },
        }),
      `Hak berdiskusi ${topic.author.fullName} dicabut.`,
    );
  };

  return (
    <section className="stack masterForum">
      <nav className="tabRow masterForumTabs" aria-label="Bagian moderasi forum">
        {(
          [
            ['topics', `Diskusi (${topics.length})`],
            ['reports', `Laporan (${reports.length})`],
            ['bans', `Dicabut (${bans.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'btnTiny btnActive' : 'btnTiny'}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="notice noticeError" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="notice" role="status">
          {notice}
        </div>
      ) : null}
      {loading ? <p className="stageNote">Memuat data forum…</p> : null}

      {!loading && tab === 'topics' ? (
        topics.length === 0 ? (
          <p className="stageNote">Belum ada diskusi.</p>
        ) : (
          <ul className="stack masterForumList">
            {topics.map((topic) => (
              <li key={topic.id} className="card masterForumCard">
                <div className="masterForumCardHead">
                  <div className="masterForumIdentity">
                    <span className="masterForumAvatar" aria-hidden="true">
                      {topic.author.avatarUrl ? (
                        <img src={topic.author.avatarUrl} alt="" />
                      ) : (
                        initials(topic.author.fullName)
                      )}
                    </span>
                    <div>
                      <strong>{topic.title}</strong>
                      <small>
                        {topic.author.fullName} · {formatDate(topic.lastActivityAt)}
                      </small>
                    </div>
                  </div>
                  <span className="inlineActions masterForumBadges">
                    {topic.isPinned ? <span className="pill pillAccent">Disematkan</span> : null}
                    {topic._count.reports > 0 ? (
                      <span className="pill pillAccent">{topic._count.reports} laporan</span>
                    ) : null}
                    <span className="pill">{STATUS_LABEL[topic.status]}</span>
                  </span>
                </div>
                <div className="masterForumMeta">
                  <span>{topic.course.title}</span>
                  <span>{topic.replyCount} balasan</span>
                  <span>{topic._count.reports} laporan</span>
                </div>
                {topic.moderationReason ? (
                  <div className="masterForumReason">
                    <strong>Alasan moderasi</strong>
                    <span>{topic.moderationReason}</span>
                  </div>
                ) : null}
                <div className="inlineActions masterForumActions">
                  {topic.status !== 'HIDDEN' ? (
                    <button
                      className="btnTiny"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void setStatus(topic, 'HIDDEN')}
                    >
                      Sembunyikan
                    </button>
                  ) : (
                    <button
                      className="btnTiny"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void setStatus(topic, 'OPEN')}
                    >
                      Tampilkan lagi
                    </button>
                  )}
                  <button
                    className="btnTiny"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void setStatus(topic, topic.status === 'LOCKED' ? 'OPEN' : 'LOCKED')}
                  >
                    {topic.status === 'LOCKED' ? 'Buka kunci' : 'Kunci'}
                  </button>
                  <button
                    className="btnTiny"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `pin-${topic.id}`,
                        () =>
                          browserClient().PATCH('/api/v1/admin/forum/topics/{topicId}/pin', {
                            params: { path: { topicId: topic.id } },
                            body: { isPinned: !topic.isPinned },
                          }),
                        topic.isPinned ? 'Sematan dilepas.' : 'Diskusi disematkan.',
                      )
                    }
                  >
                    {topic.isPinned ? 'Lepas sematan' : 'Sematkan'}
                  </button>
                  <button
                    className="btnTiny"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void banUser(topic, 'course')}
                  >
                    Cabut hak di kursus ini
                  </button>
                  <button
                    className="btnTiny"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void banUser(topic, 'global')}
                  >
                    Cabut hak di semua forum
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {!loading && tab === 'reports' ? (
        reports.length === 0 ? (
          <p className="stageNote">Tidak ada laporan yang menunggu.</p>
        ) : (
          <ul className="stack">
            {reports.map((report) => (
              <li key={report.id} className="card">
                <div className="rowBetween">
                  <div>
                    <strong>{report.topic?.title ?? report.reply?.topic.title ?? 'Konten'}</strong>
                    <small className="muted">
                      Dilaporkan {report.reporter.fullName} · {formatDate(report.createdAt)}
                    </small>
                  </div>
                  <span className="pill">{report.reply ? 'Balasan' : 'Topik'}</span>
                </div>
                <p>{report.reason}</p>
                {report.reply ? <blockquote>{report.reply.body}</blockquote> : null}
                <div className="inlineActions">
                  {report.reply && !report.reply.isHidden ? (
                    <button
                      className="btnTiny"
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(
                          `hide-${report.id}`,
                          () =>
                            browserClient().PATCH('/api/v1/admin/forum/replies/{replyId}/hidden', {
                              params: { path: { replyId: report.reply!.id } },
                              body: { isHidden: true, reason: report.reason.slice(0, 500) },
                            }),
                          'Balasan disembunyikan.',
                        )
                      }
                    >
                      Sembunyikan balasan
                    </button>
                  ) : null}
                  <button
                    className="btnTiny"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `report-${report.id}`,
                        () =>
                          browserClient().PATCH('/api/v1/admin/forum/reports/{reportId}', {
                            params: { path: { reportId: report.id } },
                            body: { status: 'ACTIONED' },
                          }),
                        'Laporan ditandai sudah ditindak.',
                      )
                    }
                  >
                    Tandai ditindak
                  </button>
                  <button
                    className="btnGhost btnSmall"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `dismiss-${report.id}`,
                        () =>
                          browserClient().PATCH('/api/v1/admin/forum/reports/{reportId}', {
                            params: { path: { reportId: report.id } },
                            body: { status: 'DISMISSED' },
                          }),
                        'Laporan diabaikan.',
                      )
                    }
                  >
                    Abaikan
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {!loading && tab === 'bans' ? (
        bans.length === 0 ? (
          <p className="stageNote">Tidak ada pelajar yang sedang dicabut haknya.</p>
        ) : (
          <ul className="stack">
            {bans.map((ban) => (
              <li key={ban.id} className="card">
                <div className="rowBetween">
                  <div>
                    <strong>{ban.user.fullName}</strong>
                    <small className="muted">
                      {ban.course ? ban.course.title : 'Seluruh forum'} · dicabut{' '}
                      {ban.issuer.fullName} · {formatDate(ban.createdAt)}
                      {ban.expiresAt ? ` · sampai ${formatDate(ban.expiresAt)}` : ' · sampai dicabut'}
                    </small>
                  </div>
                  <button
                    className="btnTiny"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `revoke-${ban.id}`,
                        () =>
                          browserClient().DELETE('/api/v1/admin/forum/bans/{banId}', {
                            params: { path: { banId: ban.id } },
                          }),
                        `Hak berdiskusi ${ban.user.fullName} dipulihkan.`,
                      )
                    }
                  >
                    Pulihkan hak
                  </button>
                </div>
                <p>{ban.reason}</p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
