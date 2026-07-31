import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import Link from 'next/link';
import { serverClient, unwrap } from '../lib/api';
import { RegistrationForm } from './registration-form';

export const metadata: Metadata = { title: 'Daftar · AIPreneur Academy' };
export const dynamic = 'force-dynamic';

type Tier = Schemas['AccessTierDto'];

export default async function RegisterPage() {
  const client = await serverClient();
  const tiers = unwrap(
    await client.GET('/api/v1/registration/tiers'),
  ) as unknown as Tier[];

  return (
    <main className="registrationShell">
      <header className="registrationHeader">
        <Link href="/login" className="brand">
          <span className="brandMark" aria-hidden="true">AI</span>
          <span>AIPreneur Academy</span>
        </Link>
        <Link className="btn btnGhost" href="/login">Sudah punya akun? Masuk</Link>
      </header>
      <section className="registrationHero">
        <span className="eyebrow">Mulai perjalanan belajarmu</span>
        <h1>Pilih Paket Belajarmu</h1>
        <p>
          Satu kali pembayaran untuk akses akademi sesuai durasi pilihanmu.
          Setelah pembayaran terverifikasi, tautan aktivasi akun dikirim ke email.
        </p>
      </section>
      <RegistrationForm tiers={tiers} />
    </main>
  );
}
