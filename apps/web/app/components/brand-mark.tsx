/**
 * Lambang merek.
 *
 * Menggantikan inisial "AI"/"AO" yang sebelumnya diketik langsung sebagai
 * teks — dua inisial berbeda sempat beredar berdampingan di halaman yang
 * berlainan.
 *
 * Sumbernya `/icon.png`, berkas yang sama dengan ikon tab, sehingga hanya ada
 * satu gambar yang perlu diganti bila lambangnya berubah kelak.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brandMark" aria-hidden="true" style={{ width: size, height: size }}>
      <img src="/icon.png" alt="" width={size} height={size} />
    </span>
  );
}
