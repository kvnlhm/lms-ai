import { escapeHtml } from './email.service';
import type { OutgoingEmail } from './email.service';

function layout(paragraphs: string[]): string {
  return paragraphs.join('');
}

export function activationEmail(input: {
  to: string;
  fullName: string;
  tierName: string;
  activationUrl: string;
}): OutgoingEmail {
  return {
    to: input.to,
    subject: 'Aktifkan akun Academy AIPreneur',
    html: layout([
      `<p>Halo ${escapeHtml(input.fullName)},</p>`,
      `<p>Pembayaran paket <strong>${escapeHtml(input.tierName)}</strong> berhasil.</p>`,
      `<p><a href="${escapeHtml(input.activationUrl)}">Aktifkan akun dan buat password</a></p>`,
      '<p>Tautan ini bersifat pribadi dan memiliki masa berlaku.</p>',
    ]),
  };
}

/**
 * Pembuktian alamat email untuk pendaftar gratis.
 *
 * Nadanya berbeda dari email aktivasi: yang ini bukan tanda pembayaran berhasil,
 * melainkan satu langkah kecil yang tersisa sebelum akunnya dapat dipakai.
 */
export function emailVerificationEmail(input: {
  to: string;
  fullName: string;
  verifyUrl: string;
}): OutgoingEmail {
  return {
    to: input.to,
    subject: 'Buktikan alamat emailmu · Academy AIPreneur',
    html: layout([
      `<p>Halo ${escapeHtml(input.fullName)},</p>`,
      '<p>Akun gratismu sudah dibuat. Satu langkah lagi supaya dapat dipakai:</p>',
      `<p><a href="${escapeHtml(input.verifyUrl)}">Buktikan alamat email ini</a></p>`,
      '<p>Sesudah itu kamu dapat menjelajahi katalog dan membuka materi contoh.</p>',
      // Sama seperti email pemulihan sandi: yang tidak merasa mendaftar tidak
      // perlu melakukan apa pun, dan itu perlu dikatakan.
      '<p>Jika kamu tidak merasa mendaftar, abaikan saja email ini.</p>',
    ]),
  };
}

/**
 * Peringatan galat baru untuk operator.
 *
 * Isinya sengaja memuat pesan dan jejak tumpukan apa adanya: penerimanya adalah
 * operator, dan surat yang hanya berbunyi "ada galat" memaksa orang membuka
 * dashboard untuk tahu apakah perlu bangun tengah malam atau tidak.
 */
export function errorAlertEmail(input: {
  to: string;
  appName: string;
  source: string;
  type: string;
  message: string;
  route?: string;
  stack?: string;
  isRegression: boolean;
  dashboardUrl: string;
}): OutgoingEmail {
  const headline = input.isRegression ? 'Galat yang sudah ditutup muncul lagi' : 'Galat baru';
  return {
    to: input.to,
    subject: `[${input.appName}] ${headline}: ${input.type}`,
    html: layout([
      `<p><strong>${escapeHtml(headline)}</strong> pada ${escapeHtml(input.source)}.</p>`,
      `<p><strong>${escapeHtml(input.type)}</strong>: ${escapeHtml(input.message)}</p>`,
      input.route ? `<p>Rute: <code>${escapeHtml(input.route)}</code></p>` : '',
      input.stack
        ? `<pre style="background:#f4f4f5;padding:12px;overflow-x:auto">${escapeHtml(input.stack)}</pre>`
        : '',
      `<p><a href="${escapeHtml(input.dashboardUrl)}">Buka daftar galat</a></p>`,
      '<p>Kejadian berikutnya untuk galat yang sama tidak dikirim lagi, agar satu masalah tidak membanjiri kotak masuk.</p>',
    ]),
  };
}

export function passwordResetEmail(input: {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): OutgoingEmail {
  return {
    to: input.to,
    subject: 'Atur ulang password Academy AIPreneur',
    html: layout([
      `<p>Halo ${escapeHtml(input.fullName)},</p>`,
      '<p>Kami menerima permintaan untuk mengatur ulang password akunmu.</p>',
      `<p><a href="${escapeHtml(input.resetUrl)}">Buat password baru</a></p>`,
      `<p>Tautan ini berlaku ${input.expiresInMinutes} menit dan hanya dapat dipakai sekali.</p>`,
      // Penting untuk korban percobaan pengambilalihan: memberi tahu bahwa
      // mengabaikan email ini sudah cukup, tanpa perlu tindakan apa pun.
      '<p>Jika kamu tidak meminta ini, abaikan saja email ini. Passwordmu tidak berubah.</p>',
    ]),
  };
}
