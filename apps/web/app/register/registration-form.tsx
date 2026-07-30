'use client';

import type { Schemas } from '@lms/api-client';
import { useState, type FormEvent } from 'react';
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
        onError: () => setMessage('Pembayaran gagal. Silakan coba lagi.'),
        onClose: () => {
          setBusy(false);
          setMessage('Pembayaran belum diselesaikan. Kamu dapat mencoba lagi.');
        },
      });
    } catch (error) {
      setBusy(false);
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'Tidak dapat menghubungi layanan pembayaran. Coba lagi.',
      );
    }
  }

  if (tiers.length === 0) {
    return <section className="card empty">Paket pendaftaran belum tersedia.</section>;
  }

  return (
    <form className="registrationFlow" onSubmit={submit}>
      <section>
        <h2>1. Pilih paket akses</h2>
        <div className="tierGrid">
          {tiers.map((tier) => (
            <label className={`tierCard${tier.id === tierId ? ' selected' : ''}`} key={tier.id}>
              <input
                type="radio"
                name="tier"
                value={tier.id}
                checked={tier.id === tierId}
                onChange={() => setTierId(tier.id)}
              />
              <span className="tierDuration">
                {tier.isLifetime ? 'Lifetime' : `${tier.durationMonths} bulan`}
              </span>
              <strong>{tier.name}</strong>
              <span className="tierPrice">{formatRupiah(tier.priceIdr)}</span>
              <p>{tier.description ?? 'Akses materi belajar dalam paket ini.'}</p>
              <ul>
                {tier.courses.map((course) => <li key={course.id}>{course.title}</li>)}
              </ul>
            </label>
          ))}
        </div>
      </section>

      <section className="card registrationDetails">
        <div>
          <h2>2. Data akun</h2>
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
        <button className="btn btnBlock" disabled={busy || !tierId}>
          {busy ? 'Memproses…' : 'Lanjut ke pembayaran'}
        </button>
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
