'use client';

import { NewPasswordForm } from '../components/new-password-form';
import { browserClient, unwrap } from '../lib/browser-api';

export function InvitationForm({ token }: { token: string }) {
  return (
    <NewPasswordForm
      token={token}
      kirim={(password, konfirmasi) =>
        browserClient()
          .POST('/api/v1/auth/accept-invitation', {
            body: { token, password, passwordConfirmation: konfirmasi },
          })
          .then(unwrap)
      }
      labelTombol="Aktifkan akun"
      labelSibuk="Mengaktifkan…"
      judulBerhasil="Akun aktif"
      pesanBerhasil="Kata sandimu sudah tersimpan. Masuk memakai email dan kata sandi itu."
      judulGagal="Akun belum dapat diaktifkan"
    />
  );
}
