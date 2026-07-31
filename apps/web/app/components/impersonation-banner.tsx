'use client';

import { useState } from 'react';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

export function ImpersonationBanner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function endPreview() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      unwrap(await browserClient().POST('/api/v1/admin/users/impersonation/end', {}));
      window.location.assign('/master/users');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sesi Master tidak dapat dipulihkan.');
      setBusy(false);
    }
  }

  return (
    <div className="impersonationBanner" role="status">
      <span><strong>Mode lihat sebagai Pelajar.</strong> Semua perubahan dinonaktifkan.</span>
      {error ? <span className="impersonationError">{error}</span> : null}
      <button type="button" onClick={() => void endPreview()} disabled={busy}>
        {busy ? 'Mengembalikan…' : 'Kembali sebagai Master'}
      </button>
    </div>
  );
}
