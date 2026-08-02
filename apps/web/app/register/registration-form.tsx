'use client';

import type { Schemas } from '@lms/api-client';
import { useState, type FormEvent } from 'react';
import { useNotifier } from '../components/notifier';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

type Tier = Schemas['AccessTierDto'];
type Checkout = Schemas['CheckoutResponseDto'];

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks: {
          onSuccess: () => void;
          onPending: () => void;
          onError: () => void;
          onClose: () => void;
        },
      ) => void;
    };
  }
}

export function RegistrationForm({ tiers }: { tiers: Tier[] }) {
  const [tierId, setTierId] = useState(tiers[0]?.id ?? '');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const notifier = useNotifier();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('Menyiapkan pembayaran aman…');
    try {
      const checkout = unwrap(
        await browserClient().POST('/api/v1/registration/checkout', {
          body: { tierId, fullName, email, phone, termsAccepted },
        }),
      ) as unknown as Checkout;
      await loadSnap(checkout.clientKey, checkout.isProduction);
      window.snap!.pay(checkout.snapToken, {
        onSuccess: () => goToStatus(checkout.orderCode),
        onPending: () => goToStatus(checkout.orderCode),
        onError: () => {
          setMessage(null);
          void notifier.error('Pembayaran gagal', { text: 'Silakan coba lagi.' });
        },
        onClose: () => {
          setBusy(false);
          setMessage('Pembayaran belum diselesaikan. Kamu dapat mencoba lagi.');
        },
      });
    } catch (error) {
      setBusy(false);
      setMessage(null);
      void notifier.error('Pembayaran belum dapat dimulai', {
        text:
          error instanceof ApiError
            ? error.message
            : 'Tidak dapat menghubungi layanan pembayaran. Coba lagi.',
      });
    }
  }

  if (tiers.length === 0) {
    return <section className="card empty">Paket pendaftaran belum tersedia.</section>;
  }

  const terpilih = tiers.find((tier) => tier.id === tierId) ?? null;

  return (
    <form className="regCard" onSubmit={submit}>
      <section>
        <h2 className="registrationSectionTitle">Pilih paket yang paling sesuai untukmu</h2>
        <div className="tierGrid">
          {tiers.map((tier) => {
            const benefits = tierBenefits(tier);
            const selected = tier.id === tierId;

            return (
              <label className={`tierCard${selected ? ' selected' : ''}`} key={tier.id}>
                <input
                  type="radio"
                  name="tier"
                  value={tier.id}
                  checked={selected}
                  onChange={() => setTierId(tier.id)}
                />
                <span className="tierSelection" aria-hidden="true">{selected ? '✓' : ''}</span>
                <span className="tierDuration">
                  {tier.isLifetime ? 'Akses Lifetime' : `Akses ${tier.durationMonths} Bulan`}
                </span>
                <strong className="tierName">{tier.name}</strong>
                <ul className="tierBenefits">
                  {benefits.map((benefit) => (
                    <li key={benefit}>
                      <span className="tierCheck" aria-hidden="true">✓</span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <span className="tierPriceLabel">Investasi belajar</span>
                <span className="tierPrice">{formatRupiah(tier.priceIdr)}</span>
                <span className="tierChoose" aria-hidden="true">
                  {selected ? 'Paket dipilih' : 'Pilih paket'}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="regDetails">
        <div>
          <h2>Data akun</h2>
          <p className="pageSub">Gunakan email dan WhatsApp aktif untuk menerima akses.</p>
        </div>
        <div className="registrationFields">
          <label className="field">
            <span>Nama lengkap</span>
            <input required minLength={3} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Nomor WhatsApp</span>
            <input
              required
              inputMode="tel"
              placeholder="081234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </div>
        <label className="checkRow">
          <input
            type="checkbox"
            required
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          <span>Saya menyetujui syarat layanan dan pemrosesan data untuk aktivasi akun.</span>
        </label>
        {message ? <p className="notice" role="status">{message}</p> : null}

        <button className="btn btnBlock regSubmit" disabled={busy || !tierId}>
          {busy ? 'Memproses…' : 'Daftar sekarang'}
        </button>

        {/* Ringkasan harga diletakkan setelah tombol, mengikuti referensi:
            angka terakhir yang dibaca sebelum membayar adalah yang benar-benar
            akan ditagihkan. Hanya satu harga yang ditampilkan karena paket di
            sistem ini memang hanya menyimpan satu harga — tidak ada harga
            normal untuk dicoret. */}
        {terpilih ? (
          <div className="regTotal">
            <span>{terpilih.name}</span>
            <strong>{formatRupiah(terpilih.priceIdr)}</strong>
            <small>
              {terpilih.isLifetime
                ? 'Akses selamanya, sekali bayar'
                : `Akses ${terpilih.durationMonths} bulan, sekali bayar`}
            </small>
          </div>
        ) : null}

        <p className="regLoginHint">
          Sudah punya akun? <a href="/login">Masuk di sini</a>
        </p>
      </section>
    </form>
  );
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function tierBenefits(tier: Tier): string[] {
  const descriptionItems = (tier.description ?? '')
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*•✓]\s*/, '').trim())
    .filter(Boolean);
  const courseItems = tier.courses.map((course) => `Akses kursus ${course.title}`);
  const items = [...descriptionItems, ...courseItems];

  return items.length > 0
    ? Array.from(new Set(items))
    : ['Akses materi belajar dalam paket ini'];
}

async function loadSnap(clientKey: string, isProduction: boolean): Promise<void> {
  const id = 'midtrans-snap-script';
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing?.dataset.clientKey !== clientKey) {
    existing?.remove();
    const script = document.createElement('script');
    script.id = id;
    script.dataset.clientKey = clientKey;
    script.src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', clientKey);
    document.body.appendChild(script);
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (window.snap) return;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  throw new Error('Midtrans Snap tidak berhasil dimuat.');
}

function goToStatus(orderCode: string): void {
  window.location.href = `/register/status?order=${encodeURIComponent(orderCode)}`;
}
