export const VIDEO_PROVISIONER = Symbol('VIDEO_PROVISIONER');

/** Izin unggah sekali pakai, diteruskan apa adanya ke peramban. */
export interface TiketUnggahVideo {
  videoId: string;
  libraryId: string;
  signature: string;
  expires: number;
  endpoint: string;
}

export interface AsetVideoBaru {
  videoAssetId: string;
  tiket: TiketUnggahVideo;
}

/**
 * Menyiapkan aset video di penyedia luar untuk modul di luar Video.
 *
 * Komunitas perlu menitipkan video lampirannya ke penyedia yang sama dengan
 * video kursus, tetapi tidak boleh menyentuh `BunnyStreamClient` langsung:
 * pengetahuan tentang penyedia mana yang dipakai, bagaimana tiketnya
 * ditandatangani, dan bagaimana asetnya dicatat adalah milik modul Video.
 * Port ini yang menyeberang, bukan klien penyedianya.
 *
 * Bentuknya sengaja tidak menyebut Bunny sama sekali, sejalan dengan ADR-013:
 * mengganti penyedia berarti mengganti implementasi port ini, bukan menyunting
 * modul komunitas.
 */
export interface VideoProvisionerPort {
  /**
   * Membuat aset video kosong beserta izin unggahnya.
   *
   * Aset dicatat lebih dulu, sebelum satu byte pun diunggah, supaya unggahan
   * yang gagal di tengah jalan tetap meninggalkan jejak yang dapat disapu —
   * bukan video yatim di penyedia yang tidak diketahui siapa pun.
   */
  siapkanUnggahan(input: {
    ownerId: string;
    title: string;
    originalName: string;
  }): Promise<AsetVideoBaru>;

  /**
   * Menyelaraskan status aset dengan keadaan sebenarnya di penyedia.
   *
   * Mengembalikan status terkini. Kegagalan menghubungi penyedia tidak
   * melempar: status yang tersimpan dikembalikan apa adanya, karena pembaca
   * lebih baik melihat "sedang diproses" daripada halaman yang gagal.
   */
  selaraskan(videoAssetId: string): Promise<string>;

  /**
   * Membuang aset beserta videonya di penyedia.
   *
   * Dipanggil ketika lampiran yang menunjuknya dihapus. Kegagalan menghubungi
   * penyedia tidak melempar: barisnya tetap ditandai terhapus, dan video yang
   * tertinggal di sana adalah sampah yang dapat disapu belakangan — jauh lebih
   * ringan daripada penghapusan lampiran yang gagal di depan penggunanya.
   */
  hapus(videoAssetId: string): Promise<void>;
}
