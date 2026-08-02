'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Check, Info, X } from './icons';

/**
 * Pemberitahuan yang sulit terlewat.
 *
 * Sebelumnya setiap peringatan tampil sebagai balok teks di dalam halaman.
 * Pada form yang panjang, pesan itu kerap berada di luar layar saat tombol
 * simpan ditekan, sehingga pengguna melihat "tidak terjadi apa-apa" padahal
 * permintaannya ditolak.
 *
 * Pembagiannya sengaja tidak seragam:
 *
 * - Galat memakai dialog yang menahan layar sampai ditutup. Galat berarti
 *   langkah yang diminta tidak terjadi, jadi pengguna harus benar-benar tahu
 *   sebelum melanjutkan.
 * - Sukses memakai toast yang hilang sendiri. Master menyimpan berkali-kali
 *   dalam satu sesi menyusun kursus; memaksa satu klik tutup untuk setiap
 *   penyimpanan justru melatih orang menutupnya tanpa membaca.
 *
 * Galat per-kolom tetap tinggal di bawah kolomnya. Modal hanya merangkumnya,
 * karena pesan "Judul wajib diisi" tidak berguna bila terlepas dari kolom
 * yang dimaksud.
 */

/** `false`/`null` berarti dibatalkan; string adalah isian dari dialog prompt. */
type DialogResult = boolean | string | null;

interface DialogRequest {
  kind: 'error' | 'info' | 'confirm' | 'prompt';
  title: string;
  text?: string;
  reasons?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  /** Panjang minimum isian; dijaga di dalam dialog supaya tidak perlu ditutup dulu. */
  minLength?: number;
  resolve: (nilai: DialogResult) => void;
}

interface Toast {
  id: number;
  tone: 'good' | 'danger';
  message: string;
}

export interface AlertOptions {
  /** Penjelasan satu kalimat di bawah judul. */
  text?: string;
  /** Rincian seperti daftar galat validasi; ditampilkan sebagai butir. */
  reasons?: string[];
}

export interface ConfirmOptions extends AlertOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Menandai tindakan merusak; tombol utamanya jadi merah. */
  danger?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  /** Label kolom isian. */
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Memakai textarea alih-alih input satu baris. */
  multiline?: boolean;
  /**
   * Panjang minimum. Dijaga di dalam dialog: menutup dialog lebih dulu lalu
   * memunculkan galat terpisah membuat isian yang sudah diketik hilang.
   */
  minLength?: number;
}

export interface Notifier {
  /** Dialog galat yang harus ditutup. Mengembalikan promise agar dapat di-await bila perlu. */
  error: (title: string, options?: AlertOptions) => Promise<void>;
  /** Dialog informasi netral. */
  info: (title: string, options?: AlertOptions) => Promise<void>;
  /** Toast hijau yang hilang sendiri. */
  success: (message: string) => void;
  /** Konfirmasi ya/tidak. `false` bila dibatalkan atau ditutup dengan Escape. */
  confirm: (title: string, options?: ConfirmOptions) => Promise<boolean>;
  /** Meminta satu isian teks. `null` bila dibatalkan. Hasilnya sudah di-trim. */
  prompt: (title: string, options?: PromptOptions) => Promise<string | null>;
}

const NotifierContext = createContext<Notifier | null>(null);

const TOAST_MS = 4000;

export function useNotifier(): Notifier {
  const notifier = useContext(NotifierContext);
  if (!notifier) {
    throw new Error('useNotifier dipakai di luar NotifierProvider.');
  }
  return notifier;
}

export function NotifierProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const berikutnya = useRef(0);

  const tutupToast = useCallback((id: number) => {
    setToasts((sekarang) => sekarang.filter((toast) => toast.id !== id));
  }, []);

  const notifier = useMemo<Notifier>(() => {
    function bukaDialog(request: Omit<DialogRequest, 'resolve'>): Promise<DialogResult> {
      return new Promise<DialogResult>((resolve) => {
        setDialog((sebelumnya) => {
          // Dialog yang tergeser tetap diselesaikan promise-nya, supaya
          // pemanggil yang menunggunya tidak menggantung selamanya.
          sebelumnya?.resolve(false);
          return { ...request, resolve };
        });
      });
    }

    function tambahToast(tone: Toast['tone'], message: string) {
      const id = (berikutnya.current += 1);
      setToasts((sekarang) => [...sekarang, { id, tone, message }]);
    }

    return {
      error: async (title, options) => {
        await bukaDialog({ kind: 'error', title, ...options });
      },
      info: async (title, options) => {
        await bukaDialog({ kind: 'info', title, ...options });
      },
      success: (message) => tambahToast('good', message),
      confirm: async (title, options) =>
        (await bukaDialog({ kind: 'confirm', title, ...options })) === true,
      prompt: async (title, options) => {
        const hasil = await bukaDialog({ kind: 'prompt', title, ...options });
        return typeof hasil === 'string' ? hasil : null;
      },
    };
  }, []);

  const selesaikan = useCallback(
    (nilai: DialogResult) => {
      dialog?.resolve(nilai);
      setDialog(null);
    },
    [dialog],
  );

  return (
    <NotifierContext.Provider value={notifier}>
      {children}
      {dialog ? <AlertDialog request={dialog} onClose={selesaikan} /> : null}
      <ToastStack toasts={toasts} onClose={tutupToast} />
    </NotifierContext.Provider>
  );
}

function AlertDialog({
  request,
  onClose,
}: {
  request: DialogRequest;
  onClose: (nilai: DialogResult) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const utama = useRef<HTMLButtonElement>(null);
  const isian = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [nilai, setNilai] = useState(request.defaultValue ?? '');
  const [galatIsian, setGalatIsian] = useState<string | null>(null);

  useEffect(() => {
    const sebelumnya = document.activeElement as HTMLElement | null;
    // Pada prompt, kursor langsung berada di kolomnya: pengguna datang ke sini
    // untuk mengetik, bukan untuk menekan tombol.
    if (isian.current) isian.current.focus();
    else utama.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(false);
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;

      // Fokus dikurung di dalam dialog. Tanpa ini, Tab membawa pengguna
      // keyboard ke halaman di belakangnya yang justru sedang diblokir.
      const fokusable = panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const pertama = fokusable[0];
      const terakhir = fokusable[fokusable.length - 1];
      if (!pertama || !terakhir) return;

      if (event.shiftKey && document.activeElement === pertama) {
        event.preventDefault();
        terakhir.focus();
      } else if (!event.shiftKey && document.activeElement === terakhir) {
        event.preventDefault();
        pertama.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    // Halaman di belakang tidak boleh ikut bergulir saat dialog terbuka.
    const gulirSemula = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = gulirSemula;
      sebelumnya?.focus();
    };
  }, [onClose]);

  const isiTeks = request.kind === 'prompt';
  const konfirmasi = request.kind === 'confirm' || isiTeks;
  const nadaBahaya = request.kind === 'error' || (konfirmasi && request.danger);

  function kirim() {
    if (!isiTeks) {
      onClose(true);
      return;
    }
    const bersih = nilai.trim();
    const minimal = request.minLength ?? 1;
    if (bersih.length < minimal) {
      // Dijaga di sini, bukan dengan menutup dialog lalu memunculkan galat
      // terpisah: menutup dialog membuang apa yang sudah diketik.
      setGalatIsian(
        minimal === 1
          ? 'Kolom ini belum diisi.'
          : `Isian minimal ${minimal} karakter.`,
      );
      isian.current?.focus();
      return;
    }
    onClose(bersih);
  }

  return (
    <div
      className="alertBackdrop"
      onMouseDown={(event) => {
        // Hanya klik pada latar yang menutup, bukan klik yang dimulai di
        // dalam panel lalu dilepas di luar saat menyeret teks.
        if (event.target !== event.currentTarget) return;
        // Prompt yang sudah diisi tidak ikut tertutup. Satu klik meleset akan
        // membuang alasan penangguhan yang baru saja diketik, dan tidak ada
        // cara mengembalikannya. window.prompt yang digantikannya pun tidak
        // menutup saat diklik di luar.
        if (isiTeks && nilai.trim() !== '') return;
        onClose(false);
      }}
    >
      <div
        ref={panel}
        className="alertDialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alertTitle"
        aria-describedby={request.text || request.reasons?.length ? 'alertBody' : undefined}
      >
        <span
          className={nadaBahaya ? 'alertIcon alertIconDanger' : 'alertIcon alertIconInfo'}
          aria-hidden="true"
        >
          {nadaBahaya ? <AlertTriangle size={28} /> : <Info size={28} />}
        </span>

        <h2 className="alertTitle" id="alertTitle">
          {request.title}
        </h2>

        {request.text || request.reasons?.length ? (
          <div className="alertBody" id="alertBody">
            {request.text ? <p className="alertText">{request.text}</p> : null}
            {request.reasons?.length ? (
              <ul className="alertReasons">
                {request.reasons.map((baris) => (
                  <li key={baris}>{baris}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {isiTeks ? (
          <div className="field alertField">
            {request.label ? <label htmlFor="alertInput">{request.label}</label> : null}
            {request.multiline ? (
              <textarea
                id="alertInput"
                ref={isian}
                value={nilai}
                placeholder={request.placeholder}
                aria-invalid={galatIsian ? true : undefined}
                onChange={(event) => {
                  setNilai(event.target.value);
                  setGalatIsian(null);
                }}
              />
            ) : (
              <input
                id="alertInput"
                ref={isian}
                value={nilai}
                placeholder={request.placeholder}
                aria-invalid={galatIsian ? true : undefined}
                onChange={(event) => {
                  setNilai(event.target.value);
                  setGalatIsian(null);
                }}
                onKeyDown={(event) => {
                  // Enter mengirim, seperti window.prompt yang digantikannya.
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    kirim();
                  }
                }}
              />
            )}
            {galatIsian ? (
              <span className="fieldError" role="alert">
                {galatIsian}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="alertActions">
          {konfirmasi ? (
            <button type="button" className="btn btnGhost" onClick={() => onClose(false)}>
              {request.cancelLabel ?? 'Batal'}
            </button>
          ) : null}
          <button
            ref={utama}
            type="button"
            className={nadaBahaya && konfirmasi ? 'btn btnDangerSolid' : 'btn'}
            onClick={kirim}
          >
            {request.confirmLabel ?? (konfirmasi ? 'Lanjutkan' : 'Mengerti')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastStack({
  toasts,
  onClose,
}: {
  toasts: Toast[];
  onClose: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="toastStack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div className={toast.tone === 'good' ? 'toastItem toastGood' : 'toastItem toastDanger'}>
      {toast.tone === 'good' ? <Check size={16} strokeWidth={3} /> : <AlertTriangle size={16} />}
      <span>{toast.message}</span>
      <button
        type="button"
        className="toastClose"
        onClick={() => onClose(toast.id)}
        aria-label="Tutup pemberitahuan"
      >
        <X size={14} />
      </button>
    </div>
  );
}
