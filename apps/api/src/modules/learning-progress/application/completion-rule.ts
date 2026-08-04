import { CompletionRule } from '@prisma/client';
import { AppError } from '../../../shared/errors/app-error';

/**
 * Ambang bawaan untuk `VIDEO_PERCENTAGE`.
 *
 * Cukup ketat untuk berarti, tetapi menyisakan ruang bagi kredit penutup dan
 * lompatan kecil di akhir. Dipakai hanya bila pelajaran belum menyimpan
 * ambangnya sendiri — di produksi seluruh `completion_config` kosong, jadi
 * tanpa nilai bawaan aturan ini akan tetap tidak berarti apa-apa.
 */
export const AMBANG_VIDEO_BAWAAN = 90;

/** Ambang bawaan untuk `MINIMUM_ACTIVE_SECONDS`, dalam detik. */
export const MINIMUM_DETIK_BAWAAN = 60;

export interface CompletionConfig {
  videoPercentage?: number;
  minimumActiveSeconds?: number;
}

/** Membaca konfigurasi JSON pelajaran tanpa memercayai bentuknya. */
export function bacaConfig(raw: unknown): CompletionConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const config = raw as Record<string, unknown>;
  const angka = (nilai: unknown): number | undefined =>
    typeof nilai === 'number' && Number.isFinite(nilai) && nilai > 0 ? nilai : undefined;
  return {
    videoPercentage: angka(config.videoPercentage),
    minimumActiveSeconds: angka(config.minimumActiveSeconds),
  };
}

/** Ambang yang berlaku untuk sebuah pelajaran, siap ditampilkan ke pelajar. */
export function ambangPelajaran(rule: CompletionRule, raw: unknown): {
  videoPercentage: number | null;
  minimumActiveSeconds: number | null;
} {
  const config = bacaConfig(raw);
  return {
    videoPercentage:
      rule === CompletionRule.VIDEO_PERCENTAGE
        ? Math.min(100, config.videoPercentage ?? AMBANG_VIDEO_BAWAAN)
        : null,
    minimumActiveSeconds:
      rule === CompletionRule.MINIMUM_ACTIVE_SECONDS
        ? (config.minimumActiveSeconds ?? MINIMUM_DETIK_BAWAAN)
        : null,
  };
}

/**
 * Menolak penyelesaian yang belum memenuhi aturan pelajarannya.
 *
 * Aturan ini tersimpan dan ditampilkan sejak lama, tetapi tidak pernah
 * ditegakkan di mana pun — Master memilihnya di editor kursus dan sistem
 * mengabaikannya diam-diam. Pemeriksaannya di server, bukan di antarmuka:
 * buktinya dikirim klien, jadi menyembunyikan tombolnya saja tidak menghalangi
 * siapa pun memanggil endpointnya langsung.
 */
export function periksaAturanPenyelesaian(
  rule: CompletionRule,
  raw: unknown,
  bukti: { activeSeconds?: number; videoPercentage?: number },
): void {
  const ambang = ambangPelajaran(rule, raw);

  if (ambang.videoPercentage !== null) {
    const ditonton = bukti.videoPercentage ?? 0;
    if (ditonton < ambang.videoPercentage) {
      throw AppError.validation({
        completion: [
          `Pelajaran ini selesai setelah ditonton minimal ${ambang.videoPercentage}%. ` +
            `Baru tercatat ${Math.floor(ditonton)}%.`,
        ],
      });
    }
  }

  if (ambang.minimumActiveSeconds !== null) {
    const aktif = bukti.activeSeconds ?? 0;
    if (aktif < ambang.minimumActiveSeconds) {
      throw AppError.validation({
        completion: [
          `Pelajaran ini selesai setelah dibuka minimal ${ambang.minimumActiveSeconds} detik. ` +
            `Baru tercatat ${Math.floor(aktif)} detik.`,
        ],
      });
    }
  }
}
