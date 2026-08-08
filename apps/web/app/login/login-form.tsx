'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { GoogleSignIn } from '../components/google-sign-in';
import { useNotifier } from '../components/notifier';
import { PasswordInput } from '../components/password-input';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

interface Props {
  nextPath: string;
  /** Client ID Google; kosong berarti tombolnya tidak ditampilkan. */
  googleClientId: string;
}

export function LoginForm({ nextPath, googleClientId }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const notifier = useNotifier();
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [mfaMode, setMfaMode] = useState<'setup' | 'verify' | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cegah pengiriman ganda saat permintaan pertama masih berjalan.
    if (busy) return;

    setBusy(true);
    setFields({});

    try {
      const client = browserClient();
      const login = unwrap(
        await client.POST('/api/v1/auth/login', {
          body: { email, password, deviceName: describeDevice() },
        }),
      );

      if (login.user.requiresMfa) {
        if (login.user.mfaSetupRequired) {
          const setup = unwrap(
            await browserClient().POST('/api/v1/auth/mfa/setup', {}),
          );
          setMfaSecret(setup.secret);
          setMfaMode('setup');
        } else {
          setMfaMode('verify');
        }
        setBusy(false);
        return;
      }

      // Cookie session sudah dipasang browser dari respons ini.
      // `refresh()` membuat Server Component mengambil ulang data dengan
      // session yang baru.
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError) {
        void notifier.error('Gagal masuk', { text: error.message });
        if (error.fields) setFields(error.fields);
        return;
      }
      void notifier.error('Tidak dapat menghubungi server', {
        text: 'Periksa koneksimu lalu coba lagi.',
      });
    }
  }

  /**
   * Masuk memakai ID token dari tombol Google.
   *
   * Sesudah token diserahkan, sisanya persis sama dengan masuk memakai kata
   * sandi — termasuk cabang MFA — karena server memang menyatukan keduanya
   * pada jalur yang sama.
   */
  async function handleGoogle(idToken: string) {
    if (busy) return;
    setBusy(true);
    setFields({});
    try {
      const login = unwrap(
        await browserClient().POST('/api/v1/auth/google', {
          body: { idToken, deviceName: describeDevice() },
        }),
      );

      if (login.user.requiresMfa) {
        if (login.user.mfaSetupRequired) {
          const setup = unwrap(await browserClient().POST('/api/v1/auth/mfa/setup', {}));
          setMfaSecret(setup.secret);
          setMfaMode('setup');
        } else {
          setMfaMode('verify');
        }
        setBusy(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError) {
        // Akun hanya dibuat sesudah pembayaran, jadi 401 di sini hampir selalu
        // berarti orangnya memang belum terdaftar — bukan salah kata sandi.
        void notifier.error('Belum bisa masuk dengan Google', {
          text: 'Akun dengan email Google itu belum terdaftar. Selesaikan pendaftaran dan pembayaran lebih dulu.',
        });
        return;
      }
      void notifier.error('Tidak dapat menghubungi server', {
        text: 'Periksa koneksimu lalu coba lagi.',
      });
    }
  }

  async function handleMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !mfaMode) return;
    setBusy(true);
    setFields({});
    try {
      const client = browserClient();
      if (mfaMode === 'setup') {
        unwrap(
          await client.POST('/api/v1/auth/mfa/setup/confirm', { body: { code: mfaCode } }),
        );
      } else {
        unwrap(await client.POST('/api/v1/auth/mfa/verify', { body: { code: mfaCode } }));
      }
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError) {
        void notifier.error('Kode belum diterima', { text: error.message });
        if (error.fields) setFields(error.fields);
        return;
      }
      void notifier.error('Tidak dapat memverifikasi autentikator', {
        text: 'Coba lagi sebentar.',
      });
    }
  }

  const emailErrors = fields.email ?? [];
  const passwordErrors = fields.password ?? [];

  if (mfaMode) {
    const codeErrors = fields.code ?? [];
    return (
      <form onSubmit={handleMfa} noValidate>
        {mfaMode === 'setup' ? (
          <div className="notice noticeInfo">
            <div>
              <p style={{ margin: 0 }}>
                Tambahkan akun ini ke aplikasi autentikator — Google Authenticator, Authy, atau
                sejenisnya — lalu masukkan kode 6 digit yang muncul.
              </p>
              <p className="mfaSecretLabel">Kunci setup</p>
              <div className="mfaSecret">
                <code>{mfaSecret}</code>
                <button
                  type="button"
                  className="btnTiny"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(mfaSecret ?? '')
                      .then(() => notifier.success('Kunci setup disalin.'))
                      .catch(() => {
                        void notifier.error('Kunci gagal disalin', {
                          text: 'Salin manual dari kotak di sebelah kiri.',
                        });
                      });
                  }}
                >
                  Salin
                </button>
              </div>
              <p style={{ margin: '8px 0 0' }}>
                Simpan kunci ini di tempat aman sampai setup berhasil. Tanpa kunci atau aplikasi
                autentikatornya, akun tidak dapat dibuka lagi.
              </p>
            </div>
          </div>
        ) : (
          <p className="authLead">Masukkan kode dari aplikasi autentikator.</p>
        )}
        <div className="field">
          <label htmlFor="mfa-code">Kode autentikator</label>
          <input
            id="mfa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={codeErrors.length > 0 || undefined}
            disabled={busy}
          />
          {codeErrors.length > 0 ? <span className="fieldError">{codeErrors.join(' ')}</span> : null}
        </div>
        <button type="submit" className="btn btnBlock" disabled={busy || mfaCode.length !== 6}>
          {busy ? 'Memverifikasi…' : mfaMode === 'setup' ? 'Aktifkan MFA' : 'Verifikasi'}
        </button>
        {/* Tanpa jalan kembali, satu-satunya cara keluar dari langkah ini
            adalah memuat ulang halaman — misalnya ketika ternyata masuk
            dengan akun yang salah. */}
        <button
          type="button"
          className="btnTiny loginBack"
          disabled={busy}
          onClick={() => {
            setMfaMode(null);
            setMfaSecret(null);
            setMfaCode('');
            setFields({});
          }}
        >
          Kembali, masuk dengan akun lain
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
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
        <PasswordInput
          id="password"
          name="password"
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

      <div className="authDivider"><span>atau</span></div>
      {/* Kartu masuk lebarnya 364 px; 400 akan meluber keluar. */}
      <GoogleSignIn clientId={googleClientId} width={360} onToken={(token) => void handleGoogle(token)} disabled={busy} />
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
