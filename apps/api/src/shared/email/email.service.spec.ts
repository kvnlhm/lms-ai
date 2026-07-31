import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { activationEmail, passwordResetEmail } from './email-templates';
import { EmailService, escapeHtml } from './email.service';

function createService(email: Partial<AppConfig['email']>): EmailService {
  const app = {
    email: {
      provider: 'RESEND',
      apiKey: 'kunci-uji',
      fromName: 'AIPreneur Academy',
      fromAddress: 'aktivasi@contoh.test',
      ...email,
    },
  } as unknown as AppConfig;
  return new EmailService({ get: () => app } as unknown as ConfigService<{ app: AppConfig }, true>);
}

describe('EmailService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('tidak memanggil provider ketika email dimatikan', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      createService({ provider: 'DISABLED' }).send({ to: 'a@b.test', subject: 's', html: '<p></p>' }),
    ).resolves.toBe('SKIPPED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('menolak berjalan ketika provider menyala tapi konfigurasinya belum lengkap', async () => {
    await expect(
      createService({ apiKey: undefined }).send({ to: 'a@b.test', subject: 's', html: '<p></p>' }),
    ).rejects.toThrow('Konfigurasi Resend belum lengkap.');
  });

  it('mengirim dengan alamat pengirim gabungan nama dan alamat', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      createService({}).send({ to: 'a@b.test', subject: 'Halo', html: '<p>isi</p>' }),
    ).resolves.toBe('SENT');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.from).toBe('AIPreneur Academy <aktivasi@contoh.test>');
    expect(body.to).toEqual(['a@b.test']);
  });

  it('menganggap balasan non-OK dari provider sebagai kegagalan', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422 }) as unknown as typeof fetch;

    await expect(
      createService({}).send({ to: 'a@b.test', subject: 's', html: '<p></p>' }),
    ).rejects.toThrow('Resend menolak permintaan (422).');
  });

  it('menelan kegagalan pada pengiriman latar belakang', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('jaringan putus')) as unknown as typeof fetch;

    // Tidak boleh melempar: pemanggilnya adalah alur yang jawabannya harus
    // sama terlepas dari berhasil atau tidaknya pengiriman.
    expect(() =>
      createService({}).sendInBackground({ to: 'a@b.test', subject: 's', html: '<p></p>' }, 'uji'),
    ).not.toThrow();
  });
});

describe('template email', () => {
  it('meloloskan HTML pada nama dan tautan', () => {
    const mail = activationEmail({
      to: 'a@b.test',
      fullName: '<script>alert(1)</script>',
      tierName: 'Akses 6 Bulan',
      activationUrl: 'https://contoh.test/a?token=x&y=1',
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('token=x&amp;y=1');
  });

  it('menyebut masa berlaku dan menenangkan penerima yang tidak meminta', () => {
    const mail = passwordResetEmail({
      to: 'a@b.test',
      fullName: 'Pelajar',
      resetUrl: 'https://contoh.test/reset-password?token=x',
      expiresInMinutes: 30,
    });

    expect(mail.subject).toContain('password');
    expect(mail.html).toContain('30 menit');
    expect(mail.html).toContain('abaikan');
  });

  it('meloloskan seluruh karakter yang berbahaya di HTML', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#039;');
  });
});
