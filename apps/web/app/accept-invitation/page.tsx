import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from '../components/icons';
import { BrandMark } from '../components/brand-mark';
import { InvitationForm } from './invitation-form';

export const metadata: Metadata = { title: 'Aktifkan akun · Academy AIPreneur' };

export default async function AcceptInvitationPage({
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
            <h1>Aktifkan akun</h1>
            <p className="pageSub">
              Satu langkah terakhir: buat kata sandi untuk akunmu. Setelah ini kamu bisa langsung
              masuk dan mulai belajar.
            </p>
            <InvitationForm token={token} />
          </>
        ) : (
          // Tanpa token tidak ada yang dapat dilakukan di halaman ini.
          // Menampilkan formulir yang seluruh kolomnya mati hanya mengundang
          // orang mencoba mengisinya lalu menemui tombol yang tidak menyala.
          <div className="activationDone">
            <span className="payIcon payIconGagal" aria-hidden="true">
              <AlertTriangle size={26} />
            </span>
            <h2>Tautan aktivasi tidak lengkap</h2>
            <p>
              Alamat yang kamu buka tidak memuat kode undangan. Buka kembali tautan aktivasi dari
              email atau WhatsApp yang kami kirim — salin seluruh alamatnya, termasuk bagian
              setelah tanda tanya.
            </p>
            <Link className="btn btnBlock" href="/login">
              Ke halaman masuk
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
