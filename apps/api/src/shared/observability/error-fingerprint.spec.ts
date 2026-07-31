import { fingerprintOf, normaliseMessage, topFrame, truncate } from './error-fingerprint';

describe('normaliseMessage', () => {
  it('menyatukan pesan yang hanya berbeda pada UUID-nya', () => {
    const a = normaliseMessage('Pengguna 3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b tidak ditemukan');
    const b = normaliseMessage('Pengguna 9b1c2d3e-4f50-6a7b-8c9d-0e1f2a3b4c5d tidak ditemukan');
    expect(a).toBe(b);
  });

  it('menyatukan pesan yang hanya berbeda pada angkanya', () => {
    expect(normaliseMessage('Batas 25 terlampaui')).toBe(normaliseMessage('Batas 900 terlampaui'));
  });

  it('menyatukan pesan yang hanya berbeda pada nilai dalam kutip', () => {
    expect(normaliseMessage('Kolom "email" wajib diisi')).toBe(
      normaliseMessage('Kolom "phone" wajib diisi'),
    );
  });

  it('tetap membedakan pesan yang memang berbeda', () => {
    expect(normaliseMessage('Database tidak terjangkau')).not.toBe(
      normaliseMessage('Redis tidak terjangkau'),
    );
  });
});

describe('topFrame', () => {
  it('melewati bingkai dari node_modules dan internal Node', () => {
    const stack = [
      'Error: gagal',
      '    at Object.run (/app/node_modules/@nestjs/core/injector.js:12:9)',
      '    at process (node:internal/process/task_queues:103:5)',
      '    at CommerceService.pay (/app/src/modules/commerce/pay.ts:44:11)',
    ].join('\n');

    expect(topFrame(stack)).toContain('CommerceService.pay');
  });

  it('mengabaikan nomor baris agar penambahan kode di atasnya tidak memecah kelompok', () => {
    const at = (line: number) =>
      topFrame(`Error: gagal\n    at Service.run (/app/src/service.ts:${line}:7)`);

    expect(at(44)).toBe(at(91));
  });

  it('mengembalikan string kosong bila tidak ada jejak tumpukan', () => {
    expect(topFrame(undefined)).toBe('');
  });
});

describe('fingerprintOf', () => {
  const base = {
    source: 'API',
    type: 'TypeError',
    message: 'Tidak dapat membaca properti id',
    route: 'GET /users/:id',
  };

  it('menghasilkan nilai sama untuk galat yang sama', () => {
    expect(fingerprintOf(base)).toBe(fingerprintOf({ ...base }));
  });

  it('membedakan rute, karena galat generik pada endpoint berbeda adalah masalah berbeda', () => {
    expect(fingerprintOf(base)).not.toBe(fingerprintOf({ ...base, route: 'POST /orders' }));
  });

  it('membedakan sumber', () => {
    expect(fingerprintOf(base)).not.toBe(fingerprintOf({ ...base, source: 'WEB' }));
  });
});

describe('truncate', () => {
  it('membiarkan nilai yang sudah pendek', () => {
    expect(truncate('halo', 10)).toBe('halo');
  });

  it('memotong dan menandai nilai yang kepanjangan', () => {
    expect(truncate('abcdefghij', 4)).toBe('abcd…');
  });
});
