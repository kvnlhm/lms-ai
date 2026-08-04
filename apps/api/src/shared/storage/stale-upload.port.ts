export const STALE_UPLOAD_RECONCILER = Symbol('STALE_UPLOAD_RECONCILER');

/**
 * Merapikan baris basis data yang tertinggal karena unggahannya tidak pernah
 * selesai.
 *
 * Menyapu berkas `.uploading` saja tidak cukup untuk modul yang mencatat
 * unggahannya sebagai baris tersendiri: barisnya tetap menggantung di status
 * berjalan, dan pemiliknya tidak dapat berbuat apa-apa terhadapnya. Modul yang
 * punya keadaan seperti itu menyediakan port ini; yang tidak, tidak perlu.
 */
export interface StaleUploadReconcilerPort {
  /**
   * Menutup unggahan yang tidak bergerak sejak `batas`.
   *
   * Mengembalikan jumlah baris yang ditutup.
   */
  closeStaleUploads(batas: Date): Promise<number>;
}
