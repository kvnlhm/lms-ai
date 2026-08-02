import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Lupa password · Academy AIPreneur' };

export default function ForgotPasswordPage() {
  return (
    <main className="authPage">
      <section className="authCard">
        <h1>Lupa password</h1>
        <p className="pageSub">
          Masukkan email akunmu. Kami kirimkan tautan untuk membuat password baru.
        </p>
        <ForgotPasswordForm />
        <p className="authFootnote">
          <Link href="/login">Kembali ke halaman masuk</Link>
        </p>
      </section>
    </main>
  );
}
