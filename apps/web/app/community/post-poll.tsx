'use client';

import { useState } from 'react';
import { browserClient, unwrap } from '../lib/browser-api';

export type PollOption = { id: string; label: string; position: number; voteCount: number };
export type Poll = { id: string; options: PollOption[]; totalVotes: number; myOptionId: string | null };

/**
 * Jajak pendapat di dalam kartu postingan.
 *
 * Hasilnya terlihat sejak awal, sebelum orangnya memilih. Menyembunyikannya
 * sampai seseorang ikut memilih memaksa orang menekan pilihan hanya untuk dapat
 * melihat hasil — dan suara yang lahir dari rasa penasaran bukan pendapat.
 *
 * Suaranya dapat dipindahkan: menekan pilihan lain memindahkan, menekan pilihan
 * yang sama tidak melakukan apa-apa.
 */
export function PostPoll({ postId, poll }: { postId: string; poll: Poll }) {
  const [nilai, setNilai] = useState(poll);
  const [pending, setPending] = useState(false);
  const [galat, setGalat] = useState('');

  async function pilih(optionId: string) {
    if (pending || nilai.myOptionId === optionId) return;
    setPending(true); setGalat('');
    try {
      const hasil = unwrap<Poll>(await browserClient().POST('/api/v1/community/posts/{postId}/poll/vote', {
        params: { path: { postId } }, body: { optionId },
      }));
      setNilai(hasil);
    } catch (error) {
      setGalat(error instanceof Error ? error.message : 'Suara gagal disimpan.');
    } finally {
      setPending(false);
    }
  }

  return <div className="postPoll">
    <ul>
      {nilai.options.map((option) => {
        const persen = nilai.totalVotes > 0 ? Math.round((option.voteCount / nilai.totalVotes) * 100) : 0;
        const dipilih = nilai.myOptionId === option.id;
        return <li key={option.id}>
          <button type="button" className={dipilih ? 'chosen' : ''} disabled={pending} aria-pressed={dipilih} onClick={() => void pilih(option.id)}>
            <span className="pollFill" style={{ width: `${persen}%` }} aria-hidden="true" />
            <span className="pollLabel">{option.label}</span>
            <span className="pollPercent">{persen}%</span>
          </button>
        </li>;
      })}
    </ul>
    <small>{nilai.totalVotes} suara{nilai.myOptionId ? ' · suaramu tercatat' : ''}</small>
    {galat ? <small role="alert" className="composerError">{galat}</small> : null}
  </div>;
}
