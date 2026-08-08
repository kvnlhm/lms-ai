'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tombol "Masuk dengan Google" resmi.
 *
 * Yang dipakai Google Identity Services, bukan alur redirect: browser
 * memperoleh ID token langsung dari Google dan menyerahkannya ke `onToken`.
 * Tidak ada halaman callback, tidak ada `state` yang perlu dititipkan, dan
 * tidak ada client secret di mana pun.
 *
 * Tombolnya dirender Google sendiri lewat `renderButton`, bukan digambar
 * ulang: tampilan tombol masuk Google terikat pedoman mereknya, dan tombol
 * tiruan adalah pelanggaran yang dapat membuat akses OAuth-nya dicabut.
 *
 * `clientId` diserahkan Server Component yang membacanya dari environment saat
 * permintaan datang — bukan lewat `NEXT_PUBLIC_*`, yang ditanam Next.js saat
 * build sehingga mengganti client id akan menuntut rebuild. Pola ini sama
 * dengan cara kunci publik Midtrans sudah dikirim ke browser di proyek ini.
 *
 * Client id kosong berarti komponen ini tidak menampilkan apa pun. Itu
 * disengaja: lebih baik pilihannya tidak terlihat daripada terlihat lalu gagal
 * saat diklik.
 */

interface Props {
  /** Client ID OAuth Google; kosong berarti fitur ini belum dikonfigurasi. */
  clientId: string;
  onToken: (idToken: string) => void;
  /** Teks pada tombol; Google hanya menerima kata yang sudah ia sediakan. */
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  disabled?: boolean;
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const SUMBER = 'https://accounts.google.com/gsi/client';

/**
 * Tema yang sedang berlaku, dengan aturan yang sama persis dengan `ThemeToggle`:
 * `data-theme` pada elemen root menang, dan tanpa itu preferensi sistem yang
 * dipakai. Menduplikasi aturannya di sini disengaja — mengangkatnya menjadi
 * konteks bersama hanya untuk satu pembaca tambahan belum sepadan.
 */
function temaSaatIni(): 'light' | 'dark' {
  const dipilih = document.documentElement.dataset.theme;
  if (dipilih === 'light' || dipilih === 'dark') return dipilih;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function GoogleSignIn({ clientId, onToken, text = 'signin_with', disabled }: Props) {
  const wadah = useRef<HTMLDivElement>(null);
  const [gagal, setGagal] = useState(false);
  // Tombolnya hidup di dalam iframe milik Google, jadi ia tidak ikut berubah
  // ketika tema halaman berganti. Satu-satunya cara menyesuaikannya adalah
  // merender ulang dengan varian tema yang lain.
  const [tema, setTema] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    setTema(temaSaatIni());
    const perbarui = () => setTema(temaSaatIni());
    const pengamat = new MutationObserver(perbarui);
    pengamat.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', perbarui);
    return () => {
      pengamat.disconnect();
      media.removeEventListener('change', perbarui);
    };
  }, []);
  // Callback disimpan pada ref supaya `initialize` tidak perlu dijalankan
  // ulang setiap kali induknya render; Google hanya membaca callback sekali.
  const simpanan = useRef(onToken);
  simpanan.current = onToken;

  useEffect(() => {
    if (!clientId || !wadah.current || !tema) return;

    let batal = false;
    const pasang = () => {
      const id = window.google?.accounts?.id;
      if (batal || !id || !wadah.current) return;
      id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) simpanan.current(response.credential);
        },
      });
      // `renderButton` menambahkan, bukan mengganti. Tanpa dikosongkan dulu,
      // berganti tema meninggalkan tombol lama di bawah yang baru.
      wadah.current.replaceChildren();
      id.renderButton(wadah.current, {
        type: 'standard',
        // `filled_black` adalah varian gelap resmi Google. Memakai `outline`
        // yang berlatar putih di halaman gelap membuat tombolnya tampak
        // seperti tempelan dari situs lain.
        theme: tema === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        text,
        shape: 'pill',
        width: 320,
        locale: 'id',
      });
    };

    if (window.google?.accounts?.id) {
      pasang();
      return () => { batal = true; };
    }

    // Skrip dimuat sekali per halaman walau komponennya dipakai lebih dari
    // satu tempat.
    const adaSkrip = document.querySelector<HTMLScriptElement>(`script[src="${SUMBER}"]`);
    const skrip = adaSkrip ?? Object.assign(document.createElement('script'), { src: SUMBER, async: true, defer: true });
    const onLoad = () => pasang();
    const onError = () => { if (!batal) setGagal(true); };
    skrip.addEventListener('load', onLoad);
    skrip.addEventListener('error', onError);
    if (!adaSkrip) document.head.appendChild(skrip);

    return () => {
      batal = true;
      skrip.removeEventListener('load', onLoad);
      skrip.removeEventListener('error', onError);
    };
  }, [clientId, text, tema]);

  if (!clientId) return null;

  return (
    <div className="googleSignIn">
      {/* Google merender tombolnya ke dalam wadah ini. */}
      <div ref={wadah} aria-busy={disabled || undefined} />
      {gagal ? (
        <p className="fieldError">
          Tombol Google tidak dapat dimuat. Periksa koneksimu, atau gunakan email dan kata sandi.
        </p>
      ) : null}
    </div>
  );
}
