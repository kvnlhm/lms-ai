import { CompletionRule } from '@prisma/client';
import { AppError } from '../../../shared/errors/app-error';
import { ambangPelajaran, periksaAturanPenyelesaian } from './completion-rule';

describe('ambangPelajaran', () => {
  it('memberi ambang bawaan ketika pelajaran belum menyimpan konfigurasinya', () => {
    // Keadaan sesungguhnya di produksi: seluruh completion_config kosong.
    // Tanpa nilai bawaan, aturan yang dipilih Master tidak berarti apa-apa.
    expect(ambangPelajaran(CompletionRule.VIDEO_PERCENTAGE, null).videoPercentage).toBe(90);
    expect(ambangPelajaran(CompletionRule.MINIMUM_ACTIVE_SECONDS, null).minimumActiveSeconds).toBe(60);
  });

  it('memakai nilai pelajaran bila ada, dan membatasi persentase pada 100', () => {
    expect(ambangPelajaran(CompletionRule.VIDEO_PERCENTAGE, { videoPercentage: 75 }).videoPercentage).toBe(75);
    expect(ambangPelajaran(CompletionRule.VIDEO_PERCENTAGE, { videoPercentage: 250 }).videoPercentage).toBe(100);
  });

  it('mengabaikan konfigurasi yang bentuknya tidak masuk akal', () => {
    for (const rusak of [undefined, 'bukan objek', [], { videoPercentage: 'delapan puluh' }, { videoPercentage: -5 }]) {
      expect(ambangPelajaran(CompletionRule.VIDEO_PERCENTAGE, rusak).videoPercentage).toBe(90);
    }
  });

  it('tidak menyebut ambang untuk aturan yang tidak memakainya', () => {
    expect(ambangPelajaran(CompletionRule.MANUAL, { videoPercentage: 75 })).toEqual({
      videoPercentage: null,
      minimumActiveSeconds: null,
    });
    expect(ambangPelajaran(CompletionRule.OPENED, null).videoPercentage).toBeNull();
  });
});

describe('periksaAturanPenyelesaian', () => {
  const kurang = () =>
    periksaAturanPenyelesaian(CompletionRule.VIDEO_PERCENTAGE, null, { videoPercentage: 42 });

  it('menolak penyelesaian yang belum memenuhi ambang tontonan', () => {
    expect(kurang).toThrow(AppError);
    // Keterangannya ada di `fields`, bukan di pesan umum AppError — di sanalah
    // antarmuka membacanya. Target dan keadaan sekarang sama-sama disebut:
    // penolakan tanpa angka hanya membuat pelajar mengira ada yang rusak.
    try {
      kurang();
    } catch (error) {
      const pesan = (error as AppError).fields?.completion?.[0] ?? '';
      expect(pesan).toContain('90%');
      expect(pesan).toContain('42%');
    }
  });

  it('menolak ketika bukti tontonan tidak dikirim sama sekali', () => {
    // Klien lama — atau klien yang sengaja menghilangkan buktinya — tidak boleh
    // lolos hanya karena tidak melaporkan apa pun.
    expect(() => periksaAturanPenyelesaian(CompletionRule.VIDEO_PERCENTAGE, null, {})).toThrow(AppError);
  });

  it('menerima setelah ambangnya terpenuhi', () => {
    expect(() =>
      periksaAturanPenyelesaian(CompletionRule.VIDEO_PERCENTAGE, null, { videoPercentage: 90 }),
    ).not.toThrow();
    expect(() =>
      periksaAturanPenyelesaian(CompletionRule.VIDEO_PERCENTAGE, { videoPercentage: 50 }, { videoPercentage: 61 }),
    ).not.toThrow();
  });

  it('menegakkan durasi aktif minimum dengan cara yang sama', () => {
    try {
      periksaAturanPenyelesaian(CompletionRule.MINIMUM_ACTIVE_SECONDS, null, { activeSeconds: 30 });
      throw new Error('seharusnya ditolak');
    } catch (error) {
      expect((error as AppError).fields?.completion?.[0]).toContain('60 detik');
    }
    expect(() =>
      periksaAturanPenyelesaian(CompletionRule.MINIMUM_ACTIVE_SECONDS, null, { activeSeconds: 60 }),
    ).not.toThrow();
  });

  it('membiarkan aturan MANUAL dan OPENED lewat tanpa bukti apa pun', () => {
    expect(() => periksaAturanPenyelesaian(CompletionRule.MANUAL, null, {})).not.toThrow();
    expect(() => periksaAturanPenyelesaian(CompletionRule.OPENED, null, {})).not.toThrow();
  });
});
