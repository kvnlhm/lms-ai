import { checkApiHealth } from '@lms/api-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const health = await checkApiHealth(apiUrl);

  return (
    <main>
      <nav aria-label="Navigasi utama">
        <a className="brand" href="/" aria-label="LMS Akademi Online">
          <span className="brandMark">AO</span>
          <span>Akademi Online</span>
        </a>
        <span className="phase">Foundation Preview</span>
      </nav>

      <section className="hero">
        <div>
          <p className="eyebrow">Belajar yang terarah, terukur, dan praktis</p>
          <h1>Kembangkan kemampuan yang benar-benar bisa dipakai.</h1>
          <p className="lead">
            Satu ruang belajar untuk coding, AI, pertumbuhan bisnis, marketing, dan kesiapan karier.
          </p>
          <div className="actions">
            <a className="primary" href="#status">Lihat status platform</a>
            <a className="secondary" href="/api/health">Health web</a>
          </div>
        </div>

        <div className="learningCard" aria-label="Pratinjau pengalaman belajar">
          <span className="cardLabel">Lanjutkan belajar</span>
          <h2>Video Editing Mastery</h2>
          <p>Teknik Editing Praktis · Pelajaran 3 dari 4</p>
          <div className="progress" aria-label="Progres 68 persen">
            <span style={{ width: '68%' }} />
          </div>
          <div className="cardFooter">
            <strong>68%</strong>
            <span>19 pelajaran</span>
          </div>
        </div>
      </section>

      <section className="statusSection" id="status" aria-labelledby="status-title">
        <div>
          <p className="eyebrow">Runtime status</p>
          <h2 id="status-title">Fondasi aplikasi</h2>
        </div>
        <div className="statusGrid">
          <StatusCard name="Next.js Web" ready detail="Halaman ini dirender oleh runtime web." />
          <StatusCard
            name="NestJS Core API"
            ready={health.ok}
            detail={health.ok ? 'Liveness API merespons.' : 'API belum dapat dijangkau dari web.'}
          />
          <StatusCard name="PostgreSQL + Redis" ready={health.ready} detail="Diverifikasi melalui readiness API." />
        </div>
      </section>
    </main>
  );
}

function StatusCard({ name, ready, detail }: { name: string; ready: boolean; detail: string }) {
  return (
    <article className="statusCard">
      <span className={ready ? 'dot ready' : 'dot'} aria-hidden="true" />
      <div>
        <h3>{name}</h3>
        <p>{detail}</p>
        <small>{ready ? 'Siap' : 'Menunggu dependency'}</small>
      </div>
    </article>
  );
}
