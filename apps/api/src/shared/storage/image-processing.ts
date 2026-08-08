import sharp from 'sharp';

/**
 * Mutu WebP untuk seluruh gambar yang diunggah.
 *
 * Diuji pada isi production sungguhan sebelum berkas aslinya dibuang. Isi itu
 * ternyata didominasi tangkapan layar, bukan foto — tempat WebP lossy paling
 * mungkin merusak teks. Potongan 1:1 pada mutu 82 tidak terbedakan dari
 * aslinya, sedangkan `nearLossless` menghasilkan berkas sepuluh kali lebih
 * besar tanpa beda yang terlihat.
 */
const MUTU = 82;

/**
 * Aliran pengolah satu gambar, untuk disisipkan ke `pipeline()`.
 *
 * Dipakai bersama oleh lampiran komunitas, thumbnail kursus, dan foto profil.
 * Ketiganya menyimpan ke tempat berbeda dengan penamaan berbeda, tetapi
 * keputusan tentang formatnya sama dan sebaiknya hanya ada di satu tempat.
 *
 * `autoOrient()` harus lebih dulu: pengodean ulang membuang blok EXIF, jadi
 * tanpa memutar duluan foto potret dari ponsel tersimpan miring selamanya dan
 * tidak ada lagi tanda yang memberitahu browser.
 *
 * Dimensi masukan dibatasi `limitInputPixels` bawaan sharp, sehingga berkas
 * kecil yang membentang menjadi ratusan megapiksel ditolak, bukan didekode.
 */
export function olahGambar(sisiMaks: number) {
  return sharp()
    .autoOrient()
    .resize({ width: sisiMaks, height: sisiMaks, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: MUTU });
}
