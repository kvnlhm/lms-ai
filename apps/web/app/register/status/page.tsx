import type { Schemas } from '@lms/api-client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, serverClient, unwrap } from '../../lib/api';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ order?: string }>;
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
  const paid = order.status === 'PAID';
  return (
    <main className="authShell">
      <section className="card authCard">
        <span className="brand">
          <span className="brandMark">AI</span>
          <span>AIPreneur Academy</span>
        </span>
        <h1 className="authTitle">{paid ? 'Pembayaran berhasil.' : statusTitle(order.status)}</h1>
        <p className="authLead">
          {paid
            ? 'Akses kursus sudah dibuat. Periksa email dan WhatsApp untuk tautan aktivasi akun.'
            : 'Status pembayaran akan diperbarui otomatis setelah diterima dari Midtrans.'}
        </p>
        <p className="notice">Kode order: <strong>{order.orderCode}</strong></p>
        {paid ? (
          <p className="pageSub">
            Email: {deliveryLabel(order.emailDeliveryStatus)} · WhatsApp:{' '}
            {deliveryLabel(order.whatsAppDeliveryStatus)}
          </p>
        ) : null}
        <div className="inlineActions">
          <Link className="btn" href="/login">Masuk</Link>
          {!paid ? <Link className="btn btnGhost" href={`/register/status?order=${order.orderCode}`}>Periksa ulang</Link> : null}
        </div>
      </section>
    </main>
  );
}

function statusTitle(status: string): string {
  if (status === 'PENDING') return 'Menunggu pembayaran.';
  if (status === 'EXPIRED') return 'Pembayaran kedaluwarsa.';
  if (status === 'CANCELLED') return 'Pembayaran dibatalkan.';
  return 'Pembayaran belum berhasil.';
}

function deliveryLabel(status: string): string {
  if (status === 'SENT') return 'terkirim';
  if (status === 'SKIPPED') return 'belum diaktifkan';
  if (status === 'FAILED') return 'gagal dikirim';
  return 'diproses';
}

