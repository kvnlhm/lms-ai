import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '../components/icons';
import { BrandMark } from '../components/brand-mark';

export const metadata: Metadata = { title: 'Syarat dan Ketentuan · Academy AIPreneur' };

export default function TermsPage() {
  return (
    <main className="regPage termsPage">
      <header className="regTop">
        <Link href="/register" className="brand">
          <BrandMark />
          <span>Academy AIPreneur</span>
        </Link>
      </header>

      <section className="regHero">
        <p className="regHeroTagline">Dokumen pendaftaran</p>
        <h1>Syarat dan Ketentuan</h1>
        <p className="regHeroLede">
          Ketentuan ini menjelaskan pembelian paket, penggunaan akun, dan akses materi di Academy
          AIPreneur.
        </p>
      </section>

      <article className="regCard termsContent">
        <p className="termsUpdated">Terakhir diperbarui: 7 Agustus 2026</p>
        <section>
          <h2>1. Pendaftaran dan akun</h2>
          <p>Data yang kamu masukkan harus benar dan dapat dihubungi. Satu akun digunakan oleh satu orang dan tautan aktivasi tidak boleh dibagikan kepada orang lain.</p>
        </section>
        <section>
          <h2>2. Paket dan akses</h2>
          <p>Setiap paket memberikan akses ke kursus yang tercantum pada halaman pendaftaran. Masa akses mengikuti durasi paket; paket lifetime tidak memiliki tanggal berakhir selama layanan tersedia.</p>
        </section>
        <section>
          <h2>3. Pembayaran</h2>
          <p>Pembayaran diproses melalui penyedia pembayaran yang ditampilkan saat checkout. Pesanan yang belum dibayar dapat kedaluwarsa. Akses dibuat setelah pembayaran dikonfirmasi.</p>
        </section>
        <section>
          <h2>4. Kode promo</h2>
          <p>Kode promo hanya berlaku bila sesuai dengan paket yang dipilih dan diterima sistem. Kode yang tidak sesuai akan ditolak saat pendaftaran.</p>
        </section>
        <section>
          <h2>5. Penggunaan materi</h2>
          <p>Materi hanya untuk pembelajaran pribadi. Dilarang menyalin, menjual kembali, mengunggah ulang, atau membagikan akses dan materi tanpa izin.</p>
        </section>
        <section>
          <h2>6. Privasi</h2>
          <p>Nama, email, dan nomor WhatsApp digunakan untuk memproses pendaftaran, pembayaran, aktivasi, dan komunikasi layanan. Data tidak dipublikasikan sebagai bagian dari materi pembelajaran.</p>
        </section>
        <section>
          <h2>7. Perubahan ketentuan</h2>
          <p>Ketentuan dapat diperbarui untuk menyesuaikan layanan atau kewajiban hukum. Versi yang berlaku selalu ditampilkan pada halaman ini.</p>
        </section>
      </article>

      <footer className="regFoot">
        <Link className="btn btnGhost" href="/register">
          <ArrowLeft size={15} /> Kembali ke pendaftaran
        </Link>
      </footer>
    </main>
  );
}
