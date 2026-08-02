'use client';

import { NewPasswordForm } from '../components/new-password-form';
import { browserClient, unwrap } from '../lib/browser-api';

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <NewPasswordForm
      token={token}
      kirim={(password, konfirmasi) =>
        browserClient()
          .POST('/api/v1/auth/reset-password', {
            body: { token, password, passwordConfirmation: konfirmasi },
          })
          .then(unwrap)
      }
      labelTombol="Simpan kata sandi baru"
      labelSibuk="Menyimpan…"
      judulBerhasil="Kata sandi diperbarui"
      pesanBerhasil="Mulai sekarang masuk memakai kata sandi yang baru saja kamu buat."
      judulGagal="Kata sandi belum tersimpan"
    />
  );
}
