'use client';

import type { Schemas } from '@lms/api-client';
import { useState, type FormEvent } from 'react';
import { ApiError, browserClient, unwrap } from '../lib/browser-api';

type Preference = Schemas['NotificationPreferenceDto'];

const OPTIONS: Array<{
  key: keyof Preference;
  title: string;
  description: string;
}> = [
  {
    key: 'announcementsEnabled',
    title: 'Pengumuman akademi',
    description: 'Informasi penting yang diterbitkan oleh Master.',
  },
  {
    key: 'courseUpdatesEnabled',
    title: 'Pembaruan kursus',
    description: 'Perubahan materi dan informasi kursus yang Anda ikuti.',
  },
  {
    key: 'learningRemindersEnabled',
    title: 'Pengingat belajar',
    description: 'Pengingat untuk melanjutkan aktivitas pembelajaran.',
  },
];

export function NotificationPreferencesForm({ initial }: { initial: Preference }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = unwrap(
        await browserClient().PUT('/api/v1/me/notifications/preferences', { body: value }),
      );
      setValue(saved);
      setMessage({ kind: 'success', text: 'Preferensi notifikasi berhasil disimpan.' });
    } catch (caught) {
      setMessage({
        kind: 'error',
        text: caught instanceof ApiError ? caught.message : 'Tidak dapat menghubungi server.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card profileSection">
      <div className="profileSectionHead">
        <h2>Preferensi notifikasi</h2>
        <p>Pilih informasi yang ingin Anda terima di dalam aplikasi.</p>
      </div>
      <form className="preferenceForm" onSubmit={save}>
        <div className="preferenceList">
          {OPTIONS.map((option) => (
            <label className="preferenceRow" key={option.key}>
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
              <input
                type="checkbox"
                checked={value[option.key]}
                disabled={busy}
                onChange={(event) => setValue((current) => ({
                  ...current,
                  [option.key]: event.target.checked,
                }))}
              />
            </label>
          ))}
        </div>
        {message ? (
          <p className={`notice ${message.kind === 'error' ? 'noticeError' : 'noticeSuccess'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        ) : null}
        <div className="profileActions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan preferensi'}
          </button>
        </div>
      </form>
    </section>
  );
}
