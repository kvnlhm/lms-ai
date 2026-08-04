'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { ActionMenu } from '../../components/action-menu';
import { useNotifier } from '../../components/notifier';
import { ApiError, browserClient, unwrap, unwrapList } from '../../lib/browser-api';

/**
 * Bentuknya datang dari OpenAPI.
 *
 * Sisi moderasi kini memakai `ModerationAuthorDto`, bukan `ForumAuthorDto`.
 * Keduanya sempat disamakan padahal `authorSelect` di `ForumModerationService`
 * mengirim surel dan tidak mengirim foto — kebalikan dari yang dilihat sesama
 * pelajar. Akibatnya halaman ini merender `author.avatarUrl` yang tidak pernah
 * ada, sementara surelnya tidak pernah terlihat.
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

function Halaman({
  page,
  totalPages,
  onChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  onChange: (halaman: number) => void;
  disabled: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="toolbar forumPager" aria-label="Navigasi halaman">
      <button
        type="button"
        className="btnTiny"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Sebelumnya
      </button>
      <span className="pill">
        Halaman {page} dari {totalPages}
      </span>
      <button
        type="button"
        className="btnTiny"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Berikutnya
      </button>
    </nav>
  );
}

/** Baris per halaman pada daftar moderasi. */
/**
 * Lama pencabutan hak berdiskusi.
 *
 * Server sudah lama menerima `expiresAt` dan menegakkannya — pesan penolakannya
 * bahkan berbunyi "sampai <tanggal>" — tetapi antarmuka tidak pernah mengirim
 * apa pun, jadi setiap pencabutan menjadi permanen dan daftarnya selalu
 * bertuliskan "sampai dicabut".
 *
 * Permanen sengaja ditaruh paling akhir: yang paling keras tidak pantas
 * menjadi pilihan bawaan.
 */
const LAMA_PENCABUTAN = [
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari' },
  { value: 'permanen', label: 'Sampai dipulihkan' },
] as const;

/** `null` untuk pencabutan permanen; selebihnya tanggal berakhirnya. */
function akhirPencabutan(pilihan: string): string | null {
  if (pilihan === 'permanen') return null;
  const hari = Number(pilihan);
  if (!Number.isFinite(hari) || hari <= 0) return null;
  return new Date(Date.now() + hari * 86_400_000).toISOString();
}

const UKURAN_HALAMAN = 25;

export function ForumModeration() {
  const notifier = useNotifier();
  const [tab, setTab] = useState<'topics' | 'reports' | 'bans'>('topics');
  const [topics, setTopics] = useState<ModerationTopic[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // Halaman per daftar. Tanpa ini, isi di luar lima puluh baris pertama tidak
  // pernah dapat dijangkau — laporan ke-51 mustahil ditangani.
  const [topicPage, setTopicPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [topicMeta, setTopicMeta] = useState({ total: 0, totalPages: 1 });
  const [reportMeta, setReportMeta] = useState({ total: 0, totalPages: 1 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = browserClient();
      const [topicsResponse, reportsResponse, bansResponse] = await Promise.all([
        client.GET('/api/v1/admin/forum/topics', {
          params: { query: { page: topicPage, pageSize: UKURAN_HALAMAN } },
        }),
        client.GET('/api/v1/admin/forum/reports', {
          params: { query: { status: 'PENDING', page: reportPage, pageSize: UKURAN_HALAMAN } },
        }),
        client.GET('/api/v1/admin/forum/bans', { params: { query: { activeOnly: true } } }),
      ]);
      // `unwrapList` dipakai, bukan `unwrap`: metanya membawa jumlah
      // sebenarnya. Sebelumnya angka pada label tab diambil dari panjang
      // larik yang sudah terpotong, sehingga 200 diskusi terbaca "50".
      const daftarTopik = unwrapList<ModerationTopic>(topicsResponse);
      const daftarLaporan = unwrapList<Report>(reportsResponse);
      setTopics(daftarTopik.items);
      setTopicMeta({ total: daftarTopik.meta.total, totalPages: daftarTopik.meta.totalPages });
      setReports(daftarLaporan.items);
      setReportMeta({ total: daftarLaporan.meta.total, totalPages: daftarLaporan.meta.totalPages });
      setBans(unwrap(bansResponse) as Ban[]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Data forum gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [topicPage, reportPage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: string, task: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(action);
    try {
      await task();
      notifier.success(success);
      await load();
    } catch (caught) {
      void notifier.error('Tindakan gagal dijalankan', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  const setStatus = async (topic: ModerationTopic, status: ModerationTopic['status']) => {
    let reason: string | undefined;
    if (status === 'HIDDEN') {
      const diisi = await notifier.prompt('Sembunyikan diskusi ini?', {
        text: `"${topic.title}" tidak akan terlihat pelajar. Alasannya tercatat di audit log.`,
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
      `status-${topic.id}`,
      () =>
        browserClient().PATCH('/api/v1/admin/forum/topics/{topicId}/status', {
          params: { path: { topicId: topic.id } },
          body: { status, reason },
        }),
      `Diskusi "${topic.title}" kini ${STATUS_LABEL[status].toLowerCase()}.`,
    );
  };

  const banUser = async (topic: ModerationTopic, scope: 'course' | 'global') => {
    const jawaban = await notifier.prompt(
      `Cabut hak berdiskusi ${topic.author.fullName}?`,
      {
        text:
          scope === 'course'
            ? 'Pencabutan berlaku pada kursus ini saja.'
            : 'Pencabutan berlaku di seluruh kursus.',
        label: 'Alasan pencabutan',
        multiline: true,
        minLength: 3,
        confirmLabel: 'Cabut hak',
        danger: true,
        choiceLabel: 'Lama pencabutan',
        choices: LAMA_PENCABUTAN,
      },
    );
    if (!jawaban) return;
    const berakhir = akhirPencabutan(jawaban.choice);
    return run(
      `ban-${topic.id}`,
      () =>
        browserClient().POST('/api/v1/admin/forum/bans', {
          body: {
            userId: topic.author.id,
            courseId: scope === 'course' ? topic.course.id : undefined,
            reason: jawaban.text,
            ...(berakhir ? { expiresAt: berakhir } : {}),
          },
        }),
      berakhir
        ? `Hak berdiskusi ${topic.author.fullName} dicabut sampai ${formatDate(berakhir)}.`
        : `Hak berdiskusi ${topic.author.fullName} dicabut sampai dipulihkan.`,
    );
  };

  return (
    <section className="stack masterForum">
      <nav className="tabRow masterForumTabs" aria-label="Bagian moderasi forum">
        {(
          [
            ['topics', `Diskusi (${topicMeta.total})`],
            ['reports', `Laporan menunggu (${reportMeta.total})`],
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
                      {initials(topic.author.fullName)}
                    </span>
                    <div>
                      <strong>{topic.title}</strong>
                      <small>
                        {topic.author.fullName} · {topic.author.email} ·{' '}
                        {formatDate(topic.lastActivityAt)}
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
                {/* Enam tindakan moderasi pernah berjajar sekaligus. Diringkas
                    menjadi satu tombol seperti pada daftar kursus. */}
                <ActionMenu label="Aksi">
                  {/* Daftar ini hanya menyebut judul. Membaca isinya — dan
                      karenanya menjawab, menandai jawaban terbaik, atau
                      menghapus balasan — menuntut halaman tersendiri. */}
                  <Link className="btnTiny" href={`/master/forum/${topic.id}`}>
                    Buka diskusi
                  </Link>
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
                </ActionMenu>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {!loading && tab === 'topics' ? (
        <Halaman
          page={topicPage}
          totalPages={topicMeta.totalPages}
          onChange={setTopicPage}
          disabled={busy !== null}
        />
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
      {!loading && tab === 'reports' ? (
        <Halaman
          page={reportPage}
          totalPages={reportMeta.totalPages}
          onChange={setReportPage}
          disabled={busy !== null}
        />
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
                      {ban.user.email} ·{' '}
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
