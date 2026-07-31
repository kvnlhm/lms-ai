'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { browserClient, unwrap } from '../lib/browser-api';

type SearchGroup = Schemas['SearchGroupDto'];

const TYPE_LABEL: Record<string, string> = {
  users: 'Pengguna',
  courses: 'Kursus',
  lessons: 'Materi',
  forum: 'Forum',
  announcements: 'Pengumuman',
};

/**
 * Pencarian lintas area (PRD 10).
 *
 * Cakupan hasilnya ditentukan server dari permission pada session, jadi
 * komponen ini tidak perlu — dan tidak boleh — menyaring apa pun sendiri.
 */
export function GlobalSearch() {
  const [term, setTerm] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const keyword = term.trim();
    if (keyword.length < 2) {
      setGroups([]);
      return;
    }

    // Penanda dideklarasikan di luar timer supaya cleanup efek ini benar-benar
    // dapat membatalkannya. Tanpa itu, jawaban atas ketikan lama bisa tiba
    // belakangan dan menimpa hasil ketikan yang lebih baru.
    let cancelled = false;

    // Jeda sebelum mengirim: mengetik "pemasaran" tanpa ini menghasilkan
    // sembilan permintaan, delapan di antaranya sudah usang saat tiba.
    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const response = await browserClient().GET('/api/v1/search', {
            params: { query: { q: keyword, limit: 5 } },
          });
          if (!cancelled) setGroups(unwrap(response) as SearchGroup[]);
        } catch {
          if (!cancelled) setGroups([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const withHits = groups.filter((group) => group.items.length > 0);
  const showPanel = open && term.trim().length >= 2;

  return (
    <div className="globalSearch" ref={container}>
      <label className="srOnly" htmlFor="globalSearchInput">
        Cari kursus, materi, forum, dan pengumuman
      </label>
      <input
        id="globalSearchInput"
        type="search"
        className="globalSearchInput"
        placeholder="Cari…"
        value={term}
        autoComplete="off"
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="globalSearchResults"
      />

      {showPanel ? (
        <div className="globalSearchPanel" id="globalSearchResults" role="listbox">
          {loading && withHits.length === 0 ? (
            <p className="globalSearchEmpty">Mencari…</p>
          ) : withHits.length === 0 ? (
            <p className="globalSearchEmpty">Tidak ada yang cocok.</p>
          ) : (
            withHits.map((group) => (
              <section key={group.type}>
                <h3 className="globalSearchGroup">
                  {TYPE_LABEL[group.type] ?? group.type}
                  {group.total > group.items.length ? (
                    <span className="muted"> · {group.total} kecocokan</span>
                  ) : null}
                </h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={`${group.type}-${item.id}`}>
                      <Link
                        className="globalSearchHit"
                        href={item.url}
                        onClick={() => setOpen(false)}
                      >
                        <strong>{item.title}</strong>
                        {item.subtitle ? <small>{item.subtitle}</small> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
