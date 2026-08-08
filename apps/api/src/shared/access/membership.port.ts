/**
 * Pertanyaan "apakah orang ini anggota berbayar", dilintasi lewat port.
 *
 * Jawabannya berasal dari `registration_orders` dan `manual_access_grants`, dan
 * keduanya milik modul commerce. Modul enrollment, community, dan forum
 * menanyakan lewat interface ini alih-alih membaca tabel itu sendiri (AGENTS.md
 * bagian 6, ADR-032).
 *
 * Portnya tinggal di `shared/` — bukan di salah satu pemanggil seperti
 * `COURSE_PREVIEW_ACCESS` — karena pemanggilnya tiga. Menggandakan interface
 * yang sama tiga kali bukan penerapan pola itu, melainkan pengulangannya.
 */
export const MEMBERSHIP_ACCESS = Symbol('MEMBERSHIP_ACCESS');

export interface MembershipAccessPort {
  /**
   * Benar bila pengguna ini punya hak akses berbayar yang masih berlaku, baik
   * dari pembelian maupun dari pemberian manual Master.
   */
  anggotaBerbayar(userId: string): Promise<boolean>;
}
