import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '../components/brand-mark';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Lupa kata sandi · Academy AIPreneur' };

export default function ForgotPasswordPage() {
  return (
    <main className="authPage">
      <Link href="/login" className="brand activationBrand">
        <BrandMark />
        <span>Academy AIPreneur</span>
      </Link>

      <section className="authCard">
        <h1>Lupa kata sandi</h1>
        <p className="pageSub">
          Masukkan email akunmu. Kami kirimkan tautan untuk membuat kata sandi baru.
        </p>
        <ForgotPasswordForm />
        <p className="authFootnote">
          <Link href="/login">Kembali ke halaman masuk</Link>
        </p>
      </section>
    </main>
  );
}
