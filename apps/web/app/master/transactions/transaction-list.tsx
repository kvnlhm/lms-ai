'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { StatusPill } from '../../components/status-pill';
import { ApiError, browserClient, unwrap, unwrapList } from '../../lib/browser-api';

type Order = Schemas['AdminRegistrationOrderDto'];
type Summary = Schemas['RegistrationOrderSummaryDto'];

const UKURAN_HALAMAN = 20;

const SARINGAN = [
  { nilai: '', label: 'Semua' },
  { nilai: 'PAID', label: 'Lunas' },
  { nilai: 'PENDING', label: 'Menunggu' },
  { nilai: 'FAILED', label: 'Gagal' },
  { nilai: 'EXPIRED', label: 'Kedaluwarsa' },
  { nilai: 'CANCELLED', label: 'Dibatalkan' },
  { nilai: 'REFUNDED', label: 'Dikembalikan' },
] as const;

const RUPIAH = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
const WAKTU = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

/** Status pengantaran undangan, diringkas jadi satu kalimat. */
function pengantaran(order: Order): string {
  const bagian: string[] = [];
  if (order.emailDeliveryStatus !== 'PENDING') bagian.push(`Email ${order.emailDeliveryStatus.toLowerCase()}`);
  if (order.whatsAppDeliveryStatus !== 'PENDING') bagian.push(`WhatsApp ${order.whatsAppDeliveryStatus.toLowerCase()}`);
  return bagian.length > 0 ? bagian.join(' · ') : 'Undangan belum dikirim';
}

/**
 * Daftar pesanan pendaftaran.
 *
 * Uang sudah lama masuk lewat Midtrans, tetapi sampai sekarang tidak ada satu
 * layar pun untuk melihatnya — satu-satunya jalan adalah membuka dashboard
 * Midtrans atau psql. Penyaringan dan pencariannya dikerjakan server, jadi
 * angkanya tetap benar berapa pun banyaknya pesanan.
 */
export function TransactionList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState('');
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [totalHalaman, setTotalHalaman] = useState(1);
  const [total, setTotal] = useState(0);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async (page: number, statusTerpilih: string, kataKunci: string) => {
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = unwrapList<Order>(
        await browserClient().GET('/api/v1/admin/registration-orders', {
          params: {
            query: {
              page,
              pageSize: UKURAN_HALAMAN,
              ...(statusTerpilih ? { status: statusTerpilih as never } : {}),
              ...(kataKunci.trim() ? { search: kataKunci.trim() } : {}),
            },
          },
        }),
      );
      // Halaman yang jadi kosong setelah penyaringan berubah dijepit kembali,
      // supaya tidak ada layar kosong yang tampak seperti "tidak ada data".
      if (hasil.items.length === 0 && hasil.meta.total > 0 && page > hasil.meta.totalPages) {
        await muat(hasil.meta.totalPages, statusTerpilih, kataKunci);
        return;
      }
      setOrders(hasil.items);
      setHalaman(hasil.meta.page);
      setTotalHalaman(Math.max(1, hasil.meta.totalPages));
      setTotal(hasil.meta.total);
    } catch (caught) {
      setGalat(caught instanceof ApiError ? caught.message : 'Daftar transaksi gagal dimuat.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat(1, status, cari);
  }, [muat, status]);

  useEffect(() => {
    void (async () => {
      try {
        setSummary(
          unwrap<Summary>(await browserClient().GET('/api/v1/admin/registration-orders/summary', {})),
        );
      } catch {
        // Ringkasan bukan isi utama halaman; kegagalannya tidak boleh
        // menghalangi daftar pesanannya tampil.
      }
    })();
  }, []);

  return (
    <>
      {summary ? (
        <div className="trxSummary">
          <div className="card trxStat">
            <span className="eyebrow">Pendapatan lunas</span>
            <strong>{RUPIAH.format(summary.paidAmount)}</strong>
            <small>{summary.paid} pesanan</small>
          </div>
          <div className="card trxStat">
            <span className="eyebrow">Menunggu bayar</span>
            <strong>{summary.pending}</strong>
            <small>belum lunas</small>
          </div>
          <div className="card trxStat">
            <span className="eyebrow">Tidak jadi</span>
            <strong>{summary.failed}</strong>
            <small>gagal, kedaluwarsa, dibatalkan</small>
          </div>
          <div className="card trxStat">
            <span className="eyebrow">Seluruh pesanan</span>
            <strong>{summary.total}</strong>
            <small>sejak awal</small>
          </div>
        </div>
      ) : null}

      <div className="card userFilterCard">
        <form
          className="userFilterBar"
          onSubmit={(event) => {
            event.preventDefault();
            void muat(1, status, cari);
          }}
        >
          <input
            aria-label="Cari transaksi"
            placeholder="Kode pesanan, nama, email, atau nomor telepon"
            value={cari}
            onChange={(event) => setCari(event.target.value)}
          />
          <select aria-label="Saring status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {SARINGAN.map((item) => (
              <option key={item.nilai} value={item.nilai}>{item.label}</option>
            ))}
          </select>
          <button className="btnSecondary" type="submit" disabled={memuat}>Cari</button>
        </form>
      </div>

      {galat ? <p className="communityMessage" role="alert">{galat}</p> : null}

      {memuat && orders.length === 0 ? (
        <div className="card empty"><p>Memuat transaksi…</p></div>
      ) : orders.length === 0 ? (
        <div className="card emptyCard">
          <p>{status || cari ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi.'}</p>
          <p className="muted">
            {status || cari
              ? 'Coba ubah kata kunci atau saringan statusnya.'
              : 'Pesanan muncul di sini begitu ada yang menyelesaikan checkout.'}
          </p>
        </div>
      ) : (
        <section className="card userTableCard">
          <div className="tableWrap">
          <table className="data">
            <thead>
              <tr>
                <th>Pesanan</th>
                <th>Pembeli</th>
                <th>Paket</th>
                <th className="num">Jumlah</th>
                <th>Status</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Pesanan">
                    <span className="cellTitle">{order.orderCode}</span>
                    <span className="cellSub">{pengantaran(order)}</span>
                  </td>
                  <td data-label="Pembeli">
                    <span className="cellTitle">{order.fullName}</span>
                    <span className="cellSub">{order.email} · {order.phone}</span>
                  </td>
                  <td data-label="Paket">{order.tierName}</td>
                  <td data-label="Jumlah" className="num">{RUPIAH.format(order.grossAmount)}</td>
                  <td data-label="Status">
                    <StatusPill status={order.status} />
                    {/* Akun otomatis adalah janji utama alur ini; kalau lunas
                        tetapi akunnya belum jadi, itu harus terlihat. */}
                    {order.status === 'PAID' && !order.provisionedUserId ? (
                      <span className="cellSub trxWarn">Akun belum dibuat</span>
                    ) : null}
                    {order.paymentType ? <span className="cellSub">{order.paymentType}</span> : null}
                  </td>
                  <td data-label="Waktu">
                    <span>{WAKTU.format(new Date(order.paidAt ?? order.createdAt))}</span>
                    <span className="cellSub">{order.paidAt ? 'dibayar' : 'dibuat'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      {totalHalaman > 1 ? (
        <nav className="toolbar enrollmentPager" aria-label="Navigasi halaman transaksi">
          <button
            className="btn btnGhost"
            type="button"
            disabled={halaman <= 1 || memuat}
            onClick={() => void muat(halaman - 1, status, cari)}
          >
            Sebelumnya
          </button>
          <span className="pill">Halaman {halaman} dari {totalHalaman} · {total} pesanan</span>
          <button
            className="btn btnGhost"
            type="button"
            disabled={halaman >= totalHalaman || memuat}
            onClick={() => void muat(halaman + 1, status, cari)}
          >
            Berikutnya
          </button>
        </nav>
      ) : null}
    </>
  );
}
