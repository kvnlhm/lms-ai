'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

interface Props {
  nextPath: string;
}

export function LoginForm({ nextPath }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cegah pengiriman ganda saat permintaan pertama masih berjalan.
    if (busy) return;

    setBusy(true);
    setMessage(null);
    setFields({});

    try {
      const client = browserClient();
      unwrap(
        await client.POST('/api/v1/auth/login', {
          body: { email, password, deviceName: describeDevice() },
        }),
      );

      // Cookie session sudah dipasang browser dari respons ini.
      // `refresh()` membuat Server Component mengambil ulang data dengan
      // session yang baru.
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError) {
        setMessage(error.message);
        if (error.fields) setFields(error.fields);
        return;
      }
      setMessage('Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.');
    }
  }

  const emailErrors = fields.email ?? [];
  const passwordErrors = fields.password ?? [];

  return (
    <form onSubmit={handleSubmit} noValidate>
      {message ? (
        <p className="notice noticeError" role="alert">
          {message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={emailErrors.length > 0 || undefined}
          aria-describedby={emailErrors.length > 0 ? 'email-error' : undefined}
          disabled={busy}
        />
        {emailErrors.length > 0 ? (
          <span className="fieldError" id="email-error">
            {emailErrors.join(' ')}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="password">Kata sandi</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={passwordErrors.length > 0 || undefined}
          aria-describedby={passwordErrors.length > 0 ? 'password-error' : undefined}
          disabled={busy}
        />
        {passwordErrors.length > 0 ? (
          <span className="fieldError" id="password-error">
            {passwordErrors.join(' ')}
          </span>
        ) : null}
      </div>

      <button type="submit" className="btn btnBlock" disabled={busy}>
        {busy ? 'Memproses…' : 'Masuk'}
      </button>
    </form>
  );
}

/** Nama perangkat yang muncul di daftar sesi aktif pengguna. */
function describeDevice(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Safari\//.test(ua)
        ? 'Safari'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : 'Peramban';
  const platform = /Mac/.test(ua)
    ? 'macOS'
    : /Windows/.test(ua)
      ? 'Windows'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : 'perangkat lain';
  return `${browser} di ${platform}`;
}
