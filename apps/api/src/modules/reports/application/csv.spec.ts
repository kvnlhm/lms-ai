import { csvCell, csvFilename, toCsv } from './csv';

describe('csvCell', () => {
  it('membiarkan teks biasa apa adanya', () => {
    expect(csvCell('Ratna Wulandari')).toBe('Ratna Wulandari');
  });

  it('membungkus sel yang memuat pemisah', () => {
    expect(csvCell('Wulandari, Ratna')).toBe('"Wulandari, Ratna"');
  });

  it('menggandakan kutip di dalam sel', () => {
    expect(csvCell('Kursus "Dasar AI"')).toBe('"Kursus ""Dasar AI"""');
  });

  it('membungkus sel yang memuat baris baru', () => {
    expect(csvCell('baris satu\nbaris dua')).toBe('"baris satu\nbaris dua"');
  });

  describe('proteksi injeksi rumus', () => {
    // Nilai-nilai ini datang dari nama, judul, dan isi forum yang ditulis
    // pengguna. Tanpa penetralan, Excel menjalankannya saat berkas dibuka.
    it.each([
      ['=HYPERLINK("http://jahat.test","Klik")'],
      ['+1+1'],
      ['-2+3'],
      ['@SUM(A1:A9)'],
      ['\tcmd'],
    ])('menetralkan %s', (input) => {
      // Sel yang dibungkus kutip tetap harus memuat penetralnya di dalam.
      expect(csvCell(input).replace(/^"/, '').startsWith("'")).toBe(true);
    });

    it('membiarkan angka negatif tetap berupa angka', () => {
      // Penjagaan hanya untuk teks pengguna. Menetralkan angka akan membuat
      // kolomnya tidak dapat dijumlahkan di spreadsheet.
      expect(csvCell(-5)).toBe('-5');
    });

    it('tidak menetralkan teks yang kebetulan memuat sama dengan di tengah', () => {
      expect(csvCell('a=b')).toBe('a=b');
    });
  });

  it('mengubah tanggal menjadi ISO agar dapat diurutkan', () => {
    expect(csvCell(new Date('2026-07-31T10:00:00.000Z'))).toBe('2026-07-31T10:00:00.000Z');
  });

  it('menuliskan boolean dalam bahasa yang terbaca', () => {
    expect(csvCell(true)).toBe('ya');
    expect(csvCell(false)).toBe('tidak');
  });

  it('mengosongkan nilai yang tidak ada', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('menyusun header dan baris dengan CRLF', () => {
    const csv = toCsv({
      headers: ['Nama', 'Progres'],
      rows: [
        ['Ratna', 80],
        ['Bagus', 45],
      ],
    });

    // BOM di depan supaya Excel membaca huruf non-ASCII dengan benar.
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Nama,Progres\r\n');
    expect(csv).toContain('Ratna,80\r\n');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('tetap menghasilkan header ketika tidak ada baris', () => {
    const csv = toCsv({ headers: ['Nama'], rows: [] });
    expect(csv).toBe('﻿Nama\r\n');
  });
});

describe('csvFilename', () => {
  it('menyertakan stempel waktu dan berakhiran csv', () => {
    expect(csvFilename('users', new Date('2026-07-31T14:05:09.000Z'))).toBe(
      'users-2026-07-31-140509.csv',
    );
  });

  it('membuang karakter yang dapat keluar dari nama berkas', () => {
    // Kunci laporan sudah dibatasi daftar tertutup di DTO, jadi ini pagar
    // kedua — tetapi header Content-Disposition bukan tempat untuk berharap.
    const name = csvFilename('../../etc/passwd', new Date('2026-07-31T00:00:00.000Z'));
    expect(name).toBe('etcpasswd-2026-07-31-000000.csv');
    expect(name).not.toContain('/');
    expect(name).not.toContain('"');
  });
});
