import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from '../components/icons';
import { BrandMark } from '../components/brand-mark';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Atur ulang kata sandi · Academy AIPreneur' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;

  return (
    <main className="authPage">
      <Link href="/login" className="brand activationBrand">
        <BrandMark />
        <span>Academy AIPreneur</span>
      </Link>

      <section className="authCard">
        {token ? (
          <>
            <h1>Atur ulang kata sandi</h1>
            <p className="pageSub">
              Buat kata sandi baru untuk akunmu. Kata sandi lama berhenti berlaku begitu yang baru
              tersimpan.
            </p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          // Tanpa token tidak ada yang dapat dikerjakan di sini. Formulir yang
          // seluruh kolomnya mati hanya mengundang orang mengisinya lalu
          // menemui tombol yang tidak menyala, tanpa tahu sebabnya.
          <div className="activationDone">
            <span className="payIcon payIconGagal" aria-hidden="true">
              <AlertTriangle size={26} />
            </span>
            <h2>Tautan pemulihan tidak lengkap</h2>
            <p>
              Alamat yang kamu buka tidak memuat kode pemulihan. Buka kembali tautan dari email
              yang kami kirim — salin seluruh alamatnya, termasuk bagian setelah tanda tanya.
              Tautannya berlaku singkat dan hanya bisa dipakai sekali.
            </p>
            <Link className="btn btnBlock" href="/forgot-password">
              Minta tautan baru
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
