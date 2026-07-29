'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserClient } from '../lib/browser-api';
import { LogOut } from './icons';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    // Klik ganda tidak boleh mengirim dua permintaan.
    if (busy) return;
    setBusy(true);
    try {
      await browserClient().POST('/api/v1/auth/logout', {});
    } finally {
      // Apa pun hasilnya, arahkan ke halaman masuk: bila session sudah tidak
      // valid di server, menahan pengguna di halaman ini tidak membantu.
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className="iconBtn"
      onClick={handleLogout}
      disabled={busy}
      title="Keluar"
      aria-label="Keluar"
    >
      <LogOut />
    </button>
  );
}
