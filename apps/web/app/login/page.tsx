import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/session';
import { ThemeToggle } from '../components/theme-toggle';
import { LoginForm } from './login-form';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Masuk · LMS AIPrenuer' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const nextPath = safeNext(params.next);

  // Session yang masih berlaku tidak perlu melihat halaman masuk.
  if (user) redirect(nextPath);

  return (
    <main className="authShell">
      <section className="card authCard" aria-labelledby="login-title">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="brand">
            <span className="brandMark" aria-hidden="true">
              AO
            </span>
            <span>AIPrenuer</span>
          </span>
          <ThemeToggle />
        </div>

        <h1 className="authTitle" id="login-title">
          Masuk ke akun kamu.
        </h1>
        <p className="authLead">Lanjutkan belajar dari pelajaran terakhir yang kamu buka.</p>

        <LoginForm nextPath={nextPath} />
        <p className="authFootnote">
          <Link href="/forgot-password">Lupa password?</Link>
        </p>
        <p className="authLead" style={{ marginTop: 12, textAlign: 'center' }}>
          Belum punya akun? <Link href="/register">Lihat paket pendaftaran</Link>
        </p>
      </section>
    </main>
  );
}

/**
 * Hanya menerima path internal.
 *
 * Tanpa penyaringan ini, `?next=https://situs-lain` akan mengubah halaman
 * masuk menjadi pengalih terbuka yang bisa dipakai untuk phishing.
 */
function safeNext(value: string | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}
