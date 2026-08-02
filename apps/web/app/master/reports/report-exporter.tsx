'use client';

import { useMemo, useState } from 'react';
import { browserApiUrl } from '../../lib/browser-api';

interface ReportDefinition {
  key: string;
  label: string;
  description: string;
  /** Penyaring yang benar-benar berpengaruh pada laporan ini. */
  uses: ('course' | 'range' | 'inactiveDays')[];
}

/**
 * Katalognya juga tersedia dari `GET /admin/reports`, tetapi keterangan dan
 * penyaring mana yang berlaku adalah urusan tampilan — menaruhnya di API hanya
 * memindahkan teks antarmuka ke tempat yang salah.
 */
const REPORTS: ReportDefinition[] = [
  {
    key: 'users',
    label: 'Pengguna',
    description: 'Seluruh akun beserta status, role, dan jumlah enrollment.',
    uses: ['range'],
  },
  {
    key: 'enrollments',
    label: 'Enrollment',
    description: 'Siapa terdaftar di kursus apa, kapan, dan oleh siapa.',
    uses: ['course', 'range'],
  },
  {
    key: 'progress',
    label: 'Progres',
    description: 'Persentase penyelesaian per pelajar per kursus.',
    uses: ['course', 'range'],
  },
  {
    key: 'course-completions',
    label: 'Penyelesaian kursus',
    description: 'Kursus yang tuntas, beserta lama waktu sampai selesai.',
    uses: ['course', 'range'],
  },
  {
    key: 'learning-activity',
    label: 'Aktivitas belajar',
    description: 'Jumlah aktivitas, hari aktif, dan total waktu belajar.',
    uses: ['course', 'range'],
  },
  {
    key: 'inactive-users',
    label: 'Pengguna tidak aktif',
    description: 'Yang berhenti membuka materi, termasuk yang belum pernah mulai.',
    uses: ['inactiveDays'],
  },
  {
    key: 'at-risk-users',
    label: 'Pengguna berisiko',
    description: 'Memakai aturan risiko yang sama dengan dashboard insight.',
    uses: [],
  },
  {
    key: 'forum',
    label: 'Forum',
    description: 'Topik, jumlah balasan, status terjawab, dan laporan konten.',
    uses: ['course', 'range'],
  },
  {
    key: 'course-performance',
    label: 'Performa kursus',
    description: 'Enrollment, tingkat penyelesaian, dan rata-rata progres per kursus.',
    uses: ['course'],
  },
];

export function ReportExporter({ courses }: { courses: { id: string; title: string }[] }) {
  const [courseId, setCourseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [inactiveDays, setInactiveDays] = useState('30');

  const hrefFor = useMemo(
    () => (report: ReportDefinition) => {
      const query = new URLSearchParams();
      if (report.uses.includes('course') && courseId) query.set('courseId', courseId);
      if (report.uses.includes('range')) {
        // `new Date('...').toISOString()` melempar bila nilainya bukan tanggal
        // yang sah, dan fungsi ini dipanggil saat merender setiap kartu — satu
        // nilai cacat akan menjatuhkan seluruh halaman, bukan satu tautan.
        const awal = keIso(from);
        const akhir = keIso(to);
        if (awal) query.set('from', awal);
        if (akhir) query.set('to', akhir);
      }
      if (report.uses.includes('inactiveDays') && inactiveDays) {
        query.set('inactiveDays', inactiveDays);
      }
      const suffix = query.toString();
      return `${browserApiUrl()}/api/v1/admin/reports/${report.key}.csv${suffix ? `?${suffix}` : ''}`;
    },
    [courseId, from, to, inactiveDays],
  );

  const describeFilters = (report: ReportDefinition): string | null => {
    const parts: string[] = [];
    if (report.uses.includes('course') && courseId) {
      parts.push(courses.find((course) => course.id === courseId)?.title ?? 'kursus terpilih');
    }
    if (report.uses.includes('range') && (from || to)) {
      parts.push(`${formatWaktu(from) ?? 'awal'} sampai ${formatWaktu(to) ?? 'sekarang'}`);
    }
    if (report.uses.includes('inactiveDays')) parts.push(`${inactiveDays} hari tanpa aktivitas`);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  return (
    <>
      <div className="card" style={{ padding: 20, marginBottom: 22 }}>
        <div className="fieldRow">
          <label className="field">
            <span>Kursus</span>
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">Semua kursus</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Dari</span>
            <input
              type="datetime-local"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Sampai</span>
            <input
              type="datetime-local"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Ambang tidak aktif (hari)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={inactiveDays}
              onChange={(event) => setInactiveDays(event.target.value)}
            />
          </label>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Setiap laporan hanya memakai penyaring yang relevan baginya, dan itu disebut di bawah
          nama laporannya.
        </p>
      </div>

      <div className="statusGrid">
        {REPORTS.map((report) => {
          const filters = describeFilters(report);
          return (
            <div key={report.key} className="card reportCard">
              <div>
                <h3>{report.label}</h3>
                <p>{report.description}</p>
                {filters ? <small>Penyaring: {filters}</small> : <small>Tanpa penyaring</small>}
              </div>
              {/* Tautan biasa, bukan fetch: unduhan berkas ditangani browser,
                  dan cookie sesi tetap ikut karena navigasi ini satu asal. */}
              <a className="btn btnGhost" href={hrefFor(report)} download>
                Unduh CSV
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * Mengubah nilai `datetime-local` menjadi ISO, atau null bila tidak sah.
 *
 * Nilai dari peramban seharusnya selalu sah atau kosong, tetapi kegagalannya
 * di sini tidak berupa tautan yang salah melainkan pengecualian saat render.
 */
function keIso(value: string): string | null {
  if (!value) return null;
  const waktu = new Date(value);
  return Number.isNaN(waktu.getTime()) ? null : waktu.toISOString();
}

/** Waktu penyaring dalam bentuk yang terbaca, bukan format mesin. */
function formatWaktu(value: string): string | null {
  if (!value) return null;
  const waktu = new Date(value);
  if (Number.isNaN(waktu.getTime())) return null;
  return waktu.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}
