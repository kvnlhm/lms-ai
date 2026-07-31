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
    subject: 'Aktifkan akun AIPreneur Academy',
    html: layout([
      `<p>Halo ${escapeHtml(input.fullName)},</p>`,
      `<p>Pembayaran paket <strong>${escapeHtml(input.tierName)}</strong> berhasil.</p>`,
      `<p><a href="${escapeHtml(input.activationUrl)}">Aktifkan akun dan buat password</a></p>`,
      '<p>Tautan ini bersifat pribadi dan memiliki masa berlaku.</p>',
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
    subject: 'Atur ulang password AIPreneur Academy',
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
