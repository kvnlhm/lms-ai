const LABELS: Record<string, { text: string; className: string }> = {
  DRAFT: { text: 'Draf', className: 'statusDraft' },
  PUBLISHED: { text: 'Terbit', className: 'statusPublished' },
  ARCHIVED: { text: 'Arsip', className: 'statusArchived' },
  ACTIVE: { text: 'Aktif', className: 'statusPublished' },
  COMPLETED: { text: 'Selesai', className: 'statusPublished' },
  REMOVED: { text: 'Dicabut', className: 'statusRemoved' },
  EXPIRED: { text: 'Kedaluwarsa', className: 'statusArchived' },
  INACTIVE: { text: 'Nonaktif', className: 'statusDraft' },
  SUSPENDED: { text: 'Ditangguhkan', className: 'statusRemoved' },
};

/**
 * Status ditulis sebagai teks, bukan hanya warna, supaya tetap terbaca
 * pembaca layar dan pengguna yang sulit membedakan warna.
 */
export function StatusPill({ status }: { status: string }) {
  const entry = LABELS[status] ?? { text: status, className: 'statusDraft' };
  return <span className={`status ${entry.className}`}>{entry.text}</span>;
}
