import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('umpan berhenti menyegarkan diri selama ada video diputar', async () => {
  // Umpan komunitas menyegarkan diri tiap lima detik. Menyusun ulang daftar
  // postingan tepat saat seseorang menonton adalah gangguan yang paling terasa
  // pada halaman berisi video.
  const feed = await read('../app/community/community-feed.tsx');

  assert.match(feed, /function adaVideoDiputar/);
  assert.match(feed, /!video\.paused && !video\.ended/);
  // Penjaganya harus berada pada `refresh`, bukan sekadar ada di berkas.
  assert.match(feed, /document\.visibilityState === 'hidden' \|\| adaVideoDiputar\(\)/);
});

test('URL playback video tidak ditandatangani ulang tiap permintaan', async () => {
  // Tanda tangan yang dihitung ulang setiap permintaan membuat `src` berubah
  // pada setiap penyegaran, pemutarnya dipasang ulang, dan tontonan kembali ke
  // detik nol.
  const service = await read('../../api/src/modules/community/application/community-attachment.service.ts');

  assert.match(service, /const jendela = ttl \/ 2;/);
  assert.match(service, /Math\.floor\(Date\.now\(\) \/ jendela\) \* jendela \+ ttl/);
});

test('pemutar tidak dipasang ulang hanya karena tanda tangannya berganti', async () => {
  const lampiran = await read('../app/community/post-attachments.tsx');

  // Yang menentukan perlu-tidaknya memasang ulang adalah identitas lampiran,
  // bukan URL-nya yang memang bermasa berlaku.
  assert.match(lampiran, /\}, \[item\.id, siap\]\);/);
  assert.doesNotMatch(lampiran, /\}, \[src\]\);/);
});

test('video ditambahkan lewat composer maupun sunting menempuh jalur penyedia yang sama', async () => {
  // Dua jalur unggah yang menyimpang berarti salah satunya diam-diam kembali
  // menyimpan video mentah di volume kita.
  const [composer, sunting] = await Promise.all([
    read('../app/community/post-composer.tsx'),
    read('../app/community/post-edit-form.tsx'),
  ]);

  for (const sumber of [composer, sunting]) {
    assert.match(sumber, /file\.type\.startsWith\('video\/'\)/);
    assert.match(sumber, /uploadDraftVideo/);
  }
});

test('video postingan memakai pemutar kustom, bukan kontrol bawaan peramban', async () => {
  // Kontrol bawaan berbeda wujudnya di setiap peramban dan tidak dapat
  // disesuaikan dengan tema. Pemutarnya memakai kelas styling video milik
  // proyek yang sama dengan pemutar pelajaran.
  const lampiran = await read('../app/community/post-attachments.tsx');

  assert.match(lampiran, /courseVideoPlayer postVideoPlayer/);
  assert.match(lampiran, /courseVideoControls/);
  assert.match(lampiran, /courseVideoSeek/);
  // Pengaturan kecepatan memakai panel yang sama dengan pemutar pelajaran.
  assert.match(lampiran, /courseVideoSettingsPanel/);
  assert.match(lampiran, /playbackRate/);
  // Video Bunny tidak boleh kembali memakai `controls` bawaan.
  assert.doesNotMatch(lampiran, /<video\s+ref=\{videoRef\}[^>]*\scontrols/);
});

test('pemutar postingan membawa lompat dan pintasan yang sama dengan pemutar pelajaran', async () => {
  // Orang membawa refleks dari satu pemutar ke pemutar lain. Peta yang berbeda
  // membuat pemutarnya terasa rusak meski setiap tombolnya bekerja.
  const lampiran = await read('../app/community/post-attachments.tsx');

  assert.match(lampiran, /courseVideoSkip/);
  assert.match(lampiran, /lompat\(-10\)/);
  assert.match(lampiran, /lompat\(10\)/);
  // Panah 5 detik, J dan L 10 detik — sama dengan pemutar pelajaran.
  assert.match(lampiran, /case 'arrowleft': lompat\(-5\)/);
  assert.match(lampiran, /case 'j': lompat\(-10\)/);
  assert.match(lampiran, /case 'l': lompat\(10\)/);
  // Pintasan hanya hidup saat pemutarnya dipegang fokus; umpan penuh kolom
  // balasan, dan spasi tidak boleh direbut dari orang yang sedang mengetik.
  assert.match(lampiran, /onKeyDown=\{pintasan\}/);
  assert.match(lampiran, /asal === 'INPUT' \|\| asal === 'SELECT' \|\| asal === 'TEXTAREA'/);
});
