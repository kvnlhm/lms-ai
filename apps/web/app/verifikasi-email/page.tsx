import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from '../components/icons';
import { BrandMark } from '../components/brand-mark';
import { VerifyEmail } from './verify-email';

export const metadata: Metadata = { title: 'Pembuktian email · Academy AIPreneur' };

export default async function VerifikasiEmailPage({
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
            <h1>Pembuktian email</h1>
            <VerifyEmail token={token} />
          </>
        ) : (
          // Tanpa token tidak ada yang dapat dikerjakan di sini, sama seperti
          // halaman pemulihan sandi.
          <div className="activationDone">
            <span className="payIcon payIconGagal" aria-hidden="true">
              <AlertTriangle size={26} />
            </span>
            <h2>Tautan tidak lengkap</h2>
            <p>
              Alamat yang kamu buka tidak memuat kode pembuktian. Buka kembali tautan dari email
              kami — salin seluruh alamatnya, termasuk bagian setelah tanda tanya.
            </p>
            <Link className="btn btnBlock" href="/daftar-gratis">
              Minta tautan baru
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
