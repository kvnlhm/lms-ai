import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const list = await readFile(new URL('../app/history/history-list.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/history/page.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

test('riwayat menumpuk, tidak menukar isinya lewat kursor di URL', () => {
  // Bentuk lama hanya punya satu tautan `?cursor=` yang mengganti seluruh
  // halaman. Sekali ditekan, riwayat yang baru dibaca hilang dan tidak ada
  // jalan kembali selain menyunting URL.
  assert.doesNotMatch(page, /searchParams/);
  assert.doesNotMatch(list, /href=\{`\/history\?cursor=/);
  assert.match(list, /Muat aktivitas lama/);
  assert.match(list, /\[\.\.\.current, \.\.\.lanjutan\.items\.filter/);
});

test('penumpukan menyaring id yang sudah tampil', () => {
  // Peristiwa baru yang masuk di antara dua permintaan menggeser jendela
  // kursornya, sehingga satu id dapat terkirim dua kali.
  assert.match(list, /const ada = new Set\(current\.map\(\(item\) => item\.id\)\)/);
  assert.match(list, /!ada\.has\(item\.id\)/);
});

test('riwayat dikelompokkan per hari pada zona waktu yang sama dengan yang ditampilkan', () => {
  assert.match(list, /timeZone: 'Asia\/Jakarta'/);
  assert.match(list, /'Hari ini'/);
  assert.match(list, /'Kemarin'/);
  assert.match(css, /\.historyDayLabel \{[^}]*position: sticky/);
});

test('durasi dan progres yang sudah lama terkirim akhirnya ditampilkan', () => {
  assert.match(list, /item\.durationSeconds/);
  assert.match(list, /Progres kursus \{progres\}%/);
  // Keduanya opsional sekaligus nullable pada kontrak; `== null` menangkap
  // dua-duanya sekaligus.
  assert.match(list, /item\.durationSeconds == null/);
  assert.match(list, /item\.progressAfter == null/);
});
