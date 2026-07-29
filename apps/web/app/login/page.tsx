import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/session';
import { ThemeToggle } from '../components/theme-toggle';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Masuk · LMS Akademi Online' };
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
            <span>Akademi Online</span>
          </span>
          <ThemeToggle />
        </div>

        <h1 className="authTitle" id="login-title">
          Masuk ke akun kamu.
        </h1>
        <p className="authLead">Lanjutkan belajar dari pelajaran terakhir yang kamu buka.</p>

        <LoginForm nextPath={nextPath} />

        <p className="authHint">
          Akun contoh untuk pengembangan lokal:
          <br />
          Pelajar <code>pelajar@akademionline.id</code> / <code>Pelajar#Lokal12345</code>
          <br />
          Master <code>master@akademionline.id</code> / <code>Master#Lokal12345</code>
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
