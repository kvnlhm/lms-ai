import lambang from '../icon.png';

/**
 * Lambang merek.
 *
 * Menggantikan inisial "AI"/"AO" yang sebelumnya diketik langsung sebagai
 * teks — dua inisial berbeda sempat beredar berdampingan di halaman yang
 * berlainan.
 *
 * Sumbernya berkas yang sama dengan ikon tab, sehingga hanya ada satu gambar
 * yang perlu diganti bila lambangnya berubah kelak.
 *
 * Berkasnya diimpor, bukan ditulis sebagai `/icon.png`. Alamat polos itu
 * dilayani dengan `immutable, max-age=31536000`, jadi browser menyimpannya
 * setahun penuh dan tidak pernah menanyakannya lagi: lambang yang sudah
 * diganti tetap tampil versi lama, dan tidak ada cara memberitahu browser
 * bahwa ia berubah. Ikon tab selamat dari itu karena Next menambahkan hash
 * pada tautannya sendiri — `<img>` di sini tidak mendapat perlakuan yang sama.
 * Dengan diimpor, alamatnya ikut membawa sidik jari isi berkasnya, sehingga
 * penggantian lambang berikutnya langsung terlihat tanpa siapa pun perlu
 * membersihkan cache.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brandMark" aria-hidden="true" style={{ width: size, height: size }}>
      <img src={lambang.src} alt="" width={size} height={size} />
    </span>
  );
}
