'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from './icons';

/**
 * Kolom kata sandi dengan tombol untuk menampilkan isinya.
 *
 * Kata sandi di sini minimal dua belas karakter dan sering diketik di ponsel,
 * tempat papan tuliknya paling mudah meleset. Tanpa cara memeriksa apa yang
 * sudah diketik, satu huruf salah hanya terlihat sebagai penolakan masuk —
 * dan orang cenderung mengulang kesalahan yang sama karena mengira sandinya
 * yang keliru, bukan ketikannya.
 *
 * Meneruskan seluruh prop ke `<input>`, jadi dapat dipakai baik terkendali
 * (`value` + `onChange`) maupun tidak (`defaultValue` atau lewat FormData).
 */
export function PasswordInput({
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [terlihat, setTerlihat] = useState(false);
  const petunjukId = useId();

  return (
    <span className="passwordField">
      <input
        {...rest}
        type={terlihat ? 'text' : 'password'}
        className={className}
        aria-describedby={
          [rest['aria-describedby'], petunjukId].filter(Boolean).join(' ') || undefined
        }
      />
      <button
        type="button"
        className="passwordReveal"
        onClick={() => setTerlihat((nilai) => !nilai)}
        disabled={rest.disabled}
        // Tombolnya tidak masuk urutan Tab: pengguna keyboard menuju kolom
        // sandi lalu langsung ke tombol masuk, dan sisipan di antaranya justru
        // memperlambat. Tetap dapat dicapai lewat navigasi pembaca layar.
        tabIndex={-1}
        aria-pressed={terlihat}
        aria-label={terlihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
      >
        {terlihat ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
      <span className="srOnly" id={petunjukId}>
        {terlihat ? 'Kata sandi sedang ditampilkan.' : 'Kata sandi disembunyikan.'}
      </span>
    </span>
  );
}
