import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../components/app-shell';
import { serverClient, unwrap } from '../../lib/api';
import { requirePermission } from '../../lib/session';

export const metadata: Metadata = { title: 'Insight pelajar · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type Insights = Schemas['LearnerInsightsDto'];
type Risk = Schemas['LearnerRiskDto'];

const RISK_PILL: Record<Risk['level'], { className: string; label: string }> = {
  HIGH: { className: 'pill pillDanger', label: 'Risiko tinggi' },
  MEDIUM: { className: 'pill pillWarn', label: 'Perlu perhatian' },
  LOW: { className: 'pill pillGood', label: 'Aman' },
};

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card metricCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
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

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await requirePermission('analytics.read', '/master/insights');
  const { days: rawDays } = await searchParams;
  const days = [7, 14, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;

  const client = await serverClient();
  const insights = unwrap(
    await client.GET('/api/v1/admin/analytics/insights', { params: { query: { days } } }),
  ) as unknown as Insights;

  const { habit, retention, forum, risk } = insights;
  const needsAttention = risk.counts.MEDIUM + risk.counts.HIGH;

  return (
    <AppShell user={user}>
      <main className="masterContent">
        <div className="pageHead">
          <div className="pageHeadMain">
            <span className="eyebrow">Analitik</span>
            <h1 className="pageTitle">Insight pelajar</h1>
            <p className="pageSub">
              Kebiasaan belajar, tingkat kembali, partisipasi forum, dan siapa yang perlu
              dihubungi — dalam {days} hari terakhir.
            </p>
          </div>
          <nav className="inlineActions" aria-label="Rentang waktu">
            {[7, 14, 30, 90].map((option) => (
              <a
                key={option}
                className={option === days ? 'btnTiny btnActive' : 'btnTiny'}
                href={`/master/insights?days=${option}`}
                aria-current={option === days ? 'page' : undefined}
              >
                {option} hari
              </a>
            ))}
          </nav>
        </div>

        <section>
          <h2 className="sectionTitle">Seberapa sering pelajar datang</h2>
          <div className="metricGrid">
            <Metric label="Aktif hari ini" value={String(habit.dailyActiveLearners)} />
            <Metric label="Aktif pekan ini" value={String(habit.weeklyActiveLearners)} />
            <Metric label="Aktif bulan ini" value={String(habit.monthlyActiveLearners)} />
            <Metric
              label="Kembali lagi"
              value={String(habit.returningLearners)}
              hint="Belajar pada dua hari berbeda atau lebih"
            />
          </div>
        </section>

        <section>
          <h2 className="sectionTitle">Pola belajar</h2>
          <div className="metricGrid">
            <Metric
              label="Hari belajar per pelajar"
              value={`${habit.averageStudyDaysPerLearner} hari`}
              hint={`Rata-rata dalam ${days} hari terakhir`}
            />
            <Metric
              label="Durasi per hari belajar"
              value={`${habit.averageMinutesPerStudyDay} menit`}
              hint="Dihitung hanya pada hari mereka aktif"
            />
            <Metric
              label="Hari paling ramai"
              value={habit.busiestWeekday ?? 'Belum ada data'}
            />
            <Metric
              label="Jam paling ramai"
              value={habit.busiestHour === null ? 'Belum ada data' : `${habit.busiestHour}.00`}
              hint="Waktu server"
            />
          </div>
        </section>

        <section>
          <h2 className="sectionTitle">Bertahan dan berdiskusi</h2>
          <div className="metricGrid">
            <Metric
              label="Kembali dalam 7 hari"
              value={`${retention.sevenDay}%`}
              hint="Dari yang aktif pekan sebelumnya"
            />
            <Metric
              label="Kembali dalam 30 hari"
              value={`${retention.thirtyDay}%`}
              hint="Dari yang aktif periode sebelumnya"
            />
            <Metric
              label="Ikut menulis di forum"
              value={`${forum.participationRate}%`}
              hint={`${forum.contributors} dari ${forum.eligibleLearners} pelajar terdaftar`}
            />
            <Metric
              label="Diskusi baru"
              value={`${forum.topics} topik`}
              hint={`${forum.replies} balasan`}
            />
          </div>
        </section>

        {forum.topContributors.length > 0 ? (
          <section className="insightSection">
            <div className="insightSectionHead">
              <div>
                <span className="eyebrow">Kontributor forum</span>
                <h2 className="sectionTitle">Paling aktif berdiskusi</h2>
              </div>
              <small>Diurutkan berdasarkan aktivitas dalam {days} hari terakhir</small>
            </div>
            <ol className="insightRanking">
              {forum.topContributors.map((contributor, index) => (
                <li key={contributor.userId} className="card insightRankCard">
                  <span className="insightRankNumber" aria-label={`Peringkat ${index + 1}`}>
                    {index + 1}
                  </span>
                  <span className="insightRankAvatar" aria-hidden="true">
                    {contributor.avatarUrl ? (
                      <img src={contributor.avatarUrl} alt="" />
                    ) : (
                      initials(contributor.fullName)
                    )}
                  </span>
                  <div className="insightRankIdentity">
                    <strong>{contributor.fullName}</strong>
                    <small>Aktif berkontribusi di forum akademi</small>
                  </div>
                  <div className="insightRankStats">
                    <span>
                      <strong>{contributor.topics}</strong>
                      <small>Topik</small>
                    </span>
                    <span>
                      <strong>{contributor.replies}</strong>
                      <small>Balasan</small>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section>
          <h2 className="sectionTitle">Pelajar yang perlu dihubungi</h2>
          <div className="metricGrid">
            <Metric label="Aman" value={String(risk.counts.LOW)} />
            <Metric label="Perlu perhatian" value={String(risk.counts.MEDIUM)} />
            <Metric label="Risiko tinggi" value={String(risk.counts.HIGH)} />
          </div>

          {needsAttention === 0 ? (
            <p className="stageNote">
              Tidak ada pelajar yang tertinggal saat ini. Semua aktif dalam tujuh hari terakhir.
            </p>
          ) : (
            <ul className="stack">
              {risk.learners.map((learner) => {
                const pill = RISK_PILL[learner.level];
                return (
                  <li key={learner.userId} className="card">
                    <div className="rowBetween">
                      <div>
                        <strong>{learner.fullName}</strong>
                        <small className="muted">{learner.email}</small>
                      </div>
                      {/* Label teks menyertai warna supaya statusnya tetap terbaca
                          tanpa membedakan warna. */}
                      <span className={pill.className}>{pill.label}</span>
                    </div>
                    <p>{learner.reason}</p>
                    <small className="muted">Progres rata-rata {learner.averageProgress}%</small>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
