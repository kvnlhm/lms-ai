import type { Metadata } from 'next';
import type { Schemas } from '@lms/api-client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, Check, Info } from '../../components/icons';
import { BrandMark } from '../../components/brand-mark';
import { ApiError, serverClient, unwrap } from '../../lib/api';
import { StatusRefresher } from './status-refresher';

export const metadata: Metadata = { title: 'Status pembayaran · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ order?: string }>;
}

type Nada = 'baik' | 'menunggu' | 'gagal';

interface Penjelasan {
  nada: Nada;
  judul: string;
  keterangan: string;
  bolehMasuk: boolean;
  bolehDaftarUlang: boolean;
  perluDipantau: boolean;
}

/**
 * Menerjemahkan status pesanan menjadi apa yang perlu diketahui pembeli.
 *
 * Sebelumnya seluruh status selain PAID memakai satu kalimat yang sama:
 * "Status pembayaran akan diperbarui otomatis setelah diterima dari Midtrans."
 * Untuk pesanan yang kedaluwarsa atau dibatalkan kalimat itu keliru — tidak
 * ada yang akan berubah, dan pembeli justru perlu mendaftar ulang. Menunggu
 * sesuatu yang tidak akan datang adalah kegagalan yang paling sunyi.
 */
function jelaskan(status: string): Penjelasan {
  if (status === 'PAID') {
    return {
      nada: 'baik',
      judul: 'Pembayaran berhasil',
      keterangan:
        'Akses kursus sudah dibuat. Tautan aktivasi dikirim ke email dan WhatsApp yang kamu ' +
        'daftarkan — buka tautan itu untuk membuat kata sandi.',
      bolehMasuk: true,
      bolehDaftarUlang: false,
      perluDipantau: false,
    };
  }

  if (status === 'PENDING') {
    return {
      nada: 'menunggu',
      judul: 'Menunggu pembayaran',
      keterangan:
        'Selesaikan pembayaran pada jendela Midtrans. Halaman ini memeriksa sendiri secara ' +
        'berkala, jadi tidak perlu dimuat ulang — begitu pembayaranmu diterima, tampilannya ' +
        'berubah dengan sendirinya.',
      bolehMasuk: false,
      bolehDaftarUlang: false,
      perluDipantau: true,
    };
  }

  if (status === 'EXPIRED') {
    return {
      nada: 'gagal',
      judul: 'Pembayaran kedaluwarsa',
      keterangan:
        'Batas waktu pembayaran pesanan ini sudah lewat dan statusnya tidak akan berubah lagi. ' +
        'Tidak ada dana yang terpotong. Daftar ulang untuk mendapatkan tagihan baru.',
      bolehMasuk: false,
      bolehDaftarUlang: true,
      perluDipantau: false,
    };
  }

  if (status === 'CANCELLED') {
    return {
      nada: 'gagal',
      judul: 'Pembayaran dibatalkan',
      keterangan:
        'Pesanan ini dibatalkan dan statusnya tidak akan berubah lagi. Daftar ulang bila kamu ' +
        'masih ingin bergabung.',
      bolehMasuk: false,
      bolehDaftarUlang: true,
      perluDipantau: false,
    };
  }

  if (status === 'REFUNDED') {
    return {
      nada: 'gagal',
      judul: 'Pembayaran dikembalikan',
      keterangan:
        'Dana pesanan ini sudah dikembalikan, sehingga aksesnya tidak berlaku. Hubungi kami ' +
        'bila menurutmu ini keliru.',
      bolehMasuk: false,
      bolehDaftarUlang: true,
      perluDipantau: false,
    };
  }

  return {
    nada: 'gagal',
    judul: 'Pembayaran tidak berhasil',
    keterangan:
      'Pembayaran untuk pesanan ini tidak dapat diselesaikan dan tidak ada dana yang terpotong. ' +
      'Daftar ulang untuk mencoba dengan metode lain.',
    bolehMasuk: false,
    bolehDaftarUlang: true,
    perluDipantau: false,
  };
}

export default async function RegistrationStatusPage({ searchParams }: Props) {
  const orderCode = (await searchParams).order;
  if (!orderCode) notFound();

  let order: Schemas['RegistrationOrderStatusDto'];
  try {
    order = unwrap(
      await (await serverClient()).GET('/api/v1/registration/orders/{orderCode}', {
        params: { path: { orderCode } },
      }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const info = jelaskan(order.status);

  return (
    <main className="payPage">
      <Link href="/login" className="brand payBrand">
        <BrandMark />
        <span>Academy AIPreneur</span>
      </Link>

      <section className="card payCard">
        <span className={`payIcon payIcon${nadaKelas(info.nada)}`} aria-hidden="true">
          {info.nada === 'baik' ? <Check size={26} strokeWidth={3} /> : null}
          {info.nada === 'gagal' ? <AlertTriangle size={26} /> : null}
          {info.nada === 'menunggu' ? <Info size={26} /> : null}
        </span>

        <h1 className="payTitle">{info.judul}</h1>
        <p className="payLede">{info.keterangan}</p>

        <dl className="payFacts">
          <div>
            <dt>Kode order</dt>
            <dd>{order.orderCode}</dd>
          </div>
          {info.nada === 'baik' ? (
            <>
              <div>
                <dt>Email aktivasi</dt>
                <dd>{labelPengiriman(order.emailDeliveryStatus)}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{labelPengiriman(order.whatsAppDeliveryStatus)}</dd>
              </div>
              <div>
                <dt>Masa akses</dt>
                <dd>
                  {order.accessEndsAt ? `Sampai ${formatTanggal(order.accessEndsAt)}` : 'Selamanya'}
                </dd>
              </div>
            </>
          ) : null}
        </dl>

        {info.perluDipantau ? <StatusRefresher /> : null}

        <div className="payActions">
          {info.bolehMasuk ? (
            <Link className="btn" href="/login">
              Masuk ke akademi
            </Link>
          ) : null}
          {info.bolehDaftarUlang ? (
            <Link className="btn" href="/register">
              Daftar ulang
            </Link>
          ) : null}
          {info.bolehMasuk ? null : (
            <Link className="btn btnGhost" href="/login">
              Halaman masuk
            </Link>
          )}
        </div>

        <p className="payHelp">
          Simpan kode order di atas bila perlu menghubungi kami tentang pesanan ini.
        </p>
      </section>
    </main>
  );
}

function nadaKelas(nada: Nada): string {
  if (nada === 'baik') return 'Baik';
  if (nada === 'gagal') return 'Gagal';
  return 'Menunggu';
}

/**
 * `SENT` dan `DELIVERED` sengaja dibedakan kata-katanya.
 *
 * `SENT` hanya berarti penyedia menerima permintaannya; pesan yang diterima
 * Meta masih bisa gagal diantar sesudahnya. Menyebut keduanya "Terkirim"
 * membuat pembeli yang tidak pernah menerima apa pun membaca halaman ini
 * sebagai kabar baik.
 */
function labelPengiriman(status: string): string {
  if (status === 'SENT') return 'Terkirim';
  if (status === 'DELIVERED') return 'Sudah sampai';
  if (status === 'SKIPPED') return 'Belum diaktifkan';
  if (status === 'FAILED') return 'Gagal dikirim';
  return 'Sedang diproses';
}

function formatTanggal(value: string | Date): string {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
