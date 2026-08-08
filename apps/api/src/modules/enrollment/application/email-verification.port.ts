/**
 * Pertanyaan kedua yang diajukan modul enrollment kepada modul identity: apakah
 * alamat email orang ini sudah terbukti.
 *
 * Ditanyakan langsung, bukan dititipkan ke payload sesi. Sesi ini opaque dan
 * berumur panjang; menyalin status verifikasi ke dalamnya berarti orang yang
 * baru saja menekan tautan verifikasi tetap ditolak sampai ia masuk ulang —
 * penolakan yang tidak dapat ia pahami maupun ia perbaiki.
 *
 * Hanya dipanggil pada jalur yang jarang: akun gratis yang membuka pelajaran
 * pratinjau. Anggota berbayar tidak pernah menanggung biayanya (ADR-032).
 */
export const EMAIL_VERIFICATION_STATUS = Symbol('EMAIL_VERIFICATION_STATUS');

export interface EmailVerificationStatusPort {
  /** Benar bila alamat email pengguna ini sudah dibuktikan. */
  emailSudahTerbukti(userId: string): Promise<boolean>;
}
