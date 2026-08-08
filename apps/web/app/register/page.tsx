import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import Link from 'next/link';
import { ArrowLeft, Globe, Instagram, MessageCircle, Plus } from '../components/icons';
import { serverClient, unwrap } from '../lib/api';
import { RegistrationForm } from './registration-form';
import { BrandMark } from '../components/brand-mark';

export const metadata: Metadata = { title: 'Daftar · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

type Tier = Schemas['AccessTierDto'];

const YANG_DIPELAJARI = [
  'Kuasai berbagai AI Tools untuk kerja, bisnis, dan konten',
  'Cara gunakan AI untuk riset, ide, dan perencanaan cepat',
  'Editing foto & video canggih cukup dari HP/laptop',
  'Bikin konten lebih cepat 5–10x tanpa tambah tim',
];

/**
 * Perannya dipisahkan dari keterangannya karena itulah yang dicari pembaca:
 * ia memindai daftar ini untuk menjawab satu pertanyaan, "apakah saya orang
 * ini?". Emoji yang dulu dipakai menandai jenis peran memang membawa
 * informasi itu, tetapi bentuknya berbeda-beda di tiap sistem operasi dan
 * warnanya bertabrakan dengan palet halaman.
 */
const COCOK_UNTUK = [
  { peran: 'Owner & Entrepreneur', lanjutan: 'yang ingin optimasi operasional pakai AI' },
  { peran: 'Social Media Specialist', lanjutan: 'yang butuh konten cepat & efektif' },
  { peran: 'Marketer & Advertiser', lanjutan: 'yang ingin hasil kampanye lebih efisien' },
  { peran: 'Mahasiswa', lanjutan: 'yang mau siap kerja dan punya skill masa depan' },
  { peran: 'Pemula', lanjutan: 'yang ingin kuasai AI dari dasar sampai jago praktik' },
];

const TAUTAN_KONTAK = [
  { label: 'Instagram', href: 'https://www.instagram.com/aipreneur.co', icon: Instagram },
  { label: 'Website', href: 'https://aipreneur.co.id', icon: Globe },
  {
    label: 'Join Group WhatsApp AIpreneur',
    href: 'https://www.whatsapp.com/channel/0029Vb5lIxR5PO0sK0TxdO1l',
    icon: MessageCircle,
  },
];

const FAQ = [
  {
    tanya: 'Emangnya belajar AI tools bisa bantu kerja & bisnis gue beneran?',
    jawab:
      'Bisa banget. Dengan AI, tugas yang biasanya makan waktu berjam-jam bisa selesai dalam ' +
      'hitungan menit. Banyak bisnis & creator sudah ngandelin AI buat riset, konten, marketing, ' +
      'sampai operasional. Ini skill yang langsung kepake!',
  },
  {
    tanya: 'Gue gaptek, bisa ikut juga gak?',
    jawab:
      'Bisa kok! Materinya dirancang dari level pemula sampai mahir. Kamu tinggal ikutin ' +
      'step-by-step-nya. Yang penting mau belajar dan praktek bareng.',
  },
  {
    tanya: 'Apa bedanya kelas ini sama yang lain?',
    jawab:
      'Ini bukan kelas cuma “kenalin tools”. Kamu diajarin cara pakainya sampai hasilnya ' +
      'impactful: lebih cepat, lebih efisien, dan lebih cuan. Plus ada studi kasus real & ' +
      'template siap pakai.',
  },
  {
    tanya: 'Tools apa aja yang bakal gue pelajarin?',
    jawab:
      'Tools terbaik untuk marketing, konten, riset, visual, dan produktivitas: Midjourney, ' +
      'Sora AI, Higgsfield, Notion AI, ElevenLabs, dan masih banyak lagi. Semuanya relevan ' +
      'dengan dunia kerja & bisnis.',
  },
  {
    tanya: 'Berapa lama sampai gue ngerasain manfaatnya?',
    jawab:
      'Secepat kamu mulai praktik! Bahkan setelah modul awal kamu sudah bisa ngerasain kerja ' +
      'lebih cepat & ide lebih lancar. Seminggu aja udah keliatan bedanya 🤝⚡',
  },
];

export default async function RegisterPage() {
  const client = await serverClient();
  const tiers = unwrap<Tier[]>(
await client.GET('/api/v1/registration/tiers')
  );

  return (
    <main className="regPage">
      <header className="regTop">
        <Link href="/login" className="brand">
          <BrandMark />
          <span>Academy AIPreneur</span>
        </Link>
      </header>

      <section className="regHero">
        <h1>
          Dapatkan Akses
          <br />
          Learn AI Tools
        </h1>
        <p className="regHeroTagline">
          AI for Business, Real Use Case Practice, AI Knowledge, Future-Ready Skills
        </p>
        <p className="regHeroLede">
          Pelajari AI dari tools sampai real-use-case yang langsung bisa dipakai untuk kerja,
          bisnis, dan konten. Praktis, fun, dan full praktik. Biar kamu nggak ketinggalan era AI
          lagi.
        </p>
      </section>

      <RegistrationForm tiers={tiers} googleClientId={process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""} />

      <section className="regSection">
        <h2>Apa yang akan kalian pelajari?</h2>
        <ul className="regCheckList">
          {YANG_DIPELAJARI.map((item) => (
            <li key={item}>
              <span className="tierCheck" aria-hidden="true">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="regNote">
          Di kelas ini, kamu nggak cuma dikasih daftar tools, tapi diajarin cara memakai AI untuk
          hasil nyata: lebih cepat, lebih hemat, lebih produktif, langsung kepake setiap hari.
        </p>
      </section>

      <section className="regSection">
        <h2>Kelas ini cocok untuk siapa?</h2>
        <ul className="regRoleList">
          {COCOK_UNTUK.map((item) => (
            <li key={item.peran}>
              <strong>{item.peran}</strong>
              <span>{item.lanjutan}</span>
            </li>
          ))}
        </ul>
        <p className="regNote">
          Ini bukan kelas cuma lihat slide. Ini kelas praktik langsung yang hasilnya kamu rasain
          sejak hari pertama. Kalau kamu udah capek kerja manual, dan pengen naik level… Saatnya
          kamu biarin AI kerja, kamu tinggal kontrol. 🤝🤖
        </p>
      </section>

      <section className="regSection">
        <h2>Frequently Asked Questions</h2>
        <p className="regSectionSub">Pertanyaan yang sering ditanyakan</p>
        <div className="regFaq">
          {FAQ.map((item, index) => (
            <details key={item.tanya}>
              <summary>
                <span className="regFaqNumber">{index + 1}</span>
                <span className="regFaqQuestion">{item.tanya}</span>
                <span className="regFaqToggle" aria-hidden="true">
                  <Plus size={17} />
                </span>
              </summary>
              <p>{item.jawab}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="regSection regContact">
        <h2>Hubungi kita lebih lanjut</h2>
        <div className="regContactLinks">
          {TAUTAN_KONTAK.map((tautan) => {
            const Icon = tautan.icon;
            return (
                <a
                  key={tautan.href}
                  className="btn btnGhost"
                  href={tautan.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon size={18} />
                  <span>{tautan.label}</span>
                </a>
            );
          })}
        </div>
      </section>

      <footer className="regFoot">
        <Link className="btn btnGhost" href="/login">
          <ArrowLeft size={15} /> Kembali ke halaman masuk
        </Link>
        <small>© 2026 AIPreneur. All rights reserved.</small>
      </footer>
    </main>
  );
}
