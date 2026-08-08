/**
 * Lambang merek.
 *
 * Menggantikan inisial "AI"/"AO" yang sebelumnya diketik langsung sebagai
 * teks — dua inisial berbeda sempat beredar berdampingan di halaman yang
 * berlainan.
 *
 * Gambarnya dipasang lewat CSS, bukan sebagai `<img>`, karena lambangnya kini
 * punya dua versi: tinta gelap untuk latar terang, tinta terang untuk latar
 * gelap. `<picture>` dengan `media` tidak cukup di sini — ia hanya membaca
 * preferensi sistem, sedangkan tema aplikasi ini dapat dipaksa lewat tombol
 * dan disimpan sebagai `data-theme` pada elemen root. Dengan CSS, pemilihannya
 * memakai selektor yang sama persis dengan seluruh warna lain, sehingga
 * lambangnya tidak pernah berselisih dengan latarnya.
 *
 * Alamat berkasnya ikut membawa sidik jari isi berkas karena diproses
 * bundler dari `url()` di stylesheet — sama seperti ketika ia masih diimpor
 * sebagai modul. Itu penting: `/icon.png` polos dilayani dengan
 * `immutable, max-age=31536000`, jadi lambang yang sudah diganti akan tetap
 * tampil versi lama selama setahun tanpa cara memberi tahu browser.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brandMark" aria-hidden="true" style={{ width: size, height: size }} />
  );
}
