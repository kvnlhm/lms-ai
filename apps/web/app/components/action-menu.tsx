import type { ReactNode } from 'react';

/** Menu tindakan yang ringkas di tabel dan editor.
 * Hover/focus membukanya di desktop; elemen details tetap dapat diketuk di mobile.
 */
export function ActionMenu({ children, label = 'Aksi' }: { children: ReactNode; label?: string }) {
  return (
    <details className="actionMenu">
      <summary aria-label={label}>{label}<span aria-hidden="true">⌄</span></summary>
      <div className="actionMenuPanel">{children}</div>
    </details>
  );
}
