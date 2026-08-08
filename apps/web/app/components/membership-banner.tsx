import Link from 'next/link';

/**
 * Penanda bahwa yang membuka halaman ini memakai akun gratis.
 *
 * Muncul di atas kurikulum, bukan sebagai dinding di depannya. Akun gratis
 * memang boleh melihat isi daftar pelajaran — yang tertutup adalah materinya —
 * dan menutupi daftar itu dengan ajakan membayar justru menghapus satu-satunya
 * alasan seseorang mau membayar (ADR-032).
 */
export function MembershipBanner({ dari }: { dari?: string }) {
  return (
    <p className="notice membershipBanner" role="status">
      <span>
        <strong>Akun gratis.</strong> Kamu dapat melihat seluruh daftar materi dan membuka
        pelajaran yang ditandai pratinjau. Sisanya terbuka setelah mengambil akses.
      </span>
      <Link className="btn btnSmall" href={dari ? `/register?dari=${encodeURIComponent(dari)}` : '/register'}>
        Ambil akses
      </Link>
    </p>
  );
}
