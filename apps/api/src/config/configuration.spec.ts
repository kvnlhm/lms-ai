import { loadConfig } from './configuration';

/**
 * Konfigurasi dibaca dari `process.env`, jadi setiap test menyiapkan
 * lingkungannya sendiri lalu mengembalikannya. Tanpa itu satu test dapat
 * mewariskan nilai ke test berikutnya dan hasilnya bergantung pada urutan.
 */
const ASLI = { ...process.env };

/**
 * Ketiganya adalah satu-satunya variabel yang `loadConfig()` tuntut ada, dan
 * ketiganya disebut di sini secara eksplisit — termasuk `MFA_ENCRYPTION_KEY`,
 * yang tidak ada hubungannya dengan pembayaran tetapi tetap wajib.
 *
 * Sebelumnya kunci itu dibiarkan menumpang dari lingkungan sekitar, dan test
 * ini lulus di mesin pengembangan hanya karena kebetulan kuncinya ada di sana.
 * Di CI ia tidak ada: `pnpm test` berjalan lewat Turborepo, yang sejak versi 2
 * hanya meneruskan variabel yang disebut pada `globalEnv`/`env`. Tiga test di
 * berkas ini gagal dengan pesan "MFA_ENCRYPTION_KEY wajib diisi" — keluhan
 * tentang kunci MFA pada test yang sedang menguji Midtrans.
 *
 * Test unit tidak boleh bergantung pada rahasia yang kebetulan ada di
 * lingkungan; kalau ia butuh sesuatu, ia menyebutkannya sendiri.
 */
function pakaiEnv(tambahan: Record<string, string | undefined>): void {
  process.env = {
    ...ASLI,
    DATABASE_URL: 'postgresql://t:t@localhost:5432/uji',
    REDIS_URL: 'redis://localhost:6379',
    MFA_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    ...tambahan,
  } as NodeJS.ProcessEnv;
}

afterEach(() => {
  process.env = { ...ASLI };
});

describe('penjaga kredensial pembayaran', () => {
  it('menolak Midtrans PRODUCTION di luar produksi', () => {
    // Staging biasanya lahir sebagai salinan produksi, dan salinan itu membawa
    // seluruh env-nya. Tanpa penjaga ini, checkout di staging benar-benar
    // menagih kartu orang.
    for (const env of ['staging', 'local', 'test']) {
      pakaiEnv({ APP_ENV: env, MIDTRANS_ENVIRONMENT: 'PRODUCTION' });
      expect(() => loadConfig()).toThrow(/MIDTRANS_ENVIRONMENT=PRODUCTION/);
      expect(() => loadConfig()).toThrow(new RegExp(`APP_ENV=${env}`));
    }
  });

  it('mengizinkan Midtrans PRODUCTION hanya pada produksi', () => {
    pakaiEnv({ APP_ENV: 'production', MIDTRANS_ENVIRONMENT: 'PRODUCTION' });
    expect(() => loadConfig()).not.toThrow();
    expect(loadConfig().commerce.midtrans.environment).toBe('PRODUCTION');
  });

  it('membiarkan SANDBOX di lingkungan mana pun', () => {
    for (const env of ['production', 'staging', 'local']) {
      pakaiEnv({ APP_ENV: env, MIDTRANS_ENVIRONMENT: 'SANDBOX' });
      expect(() => loadConfig()).not.toThrow();
    }
  });

  it('memakai SANDBOX sebagai bawaan ketika tidak disebut sama sekali', () => {
    // Bawaan yang aman: lupa menyetelnya tidak boleh berarti menerima uang.
    pakaiEnv({ APP_ENV: 'staging', MIDTRANS_ENVIRONMENT: undefined });
    expect(loadConfig().commerce.midtrans.environment).toBe('SANDBOX');
  });
});
