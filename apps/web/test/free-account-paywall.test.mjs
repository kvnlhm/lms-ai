import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('pelajaran terkunci mengarahkan ke penawaran, bukan memantulkan ke daftar kursus', async () => {
  const source = await read('../app/learn/[courseId]/[lessonId]/page.tsx');

  // 402 punya jalan keluar; 403 tidak. Keduanya sengaja ditangani berbeda.
  assert.match(source, /isMembershipRequired/);
  assert.match(source, /redirect\(`\/register\?dari=\$\{encodeURIComponent\(path\)\}`\)/);
  assert.match(source, /if \(error\.isForbidden\) redirect\(`\/courses\/\$\{courseId\}`\)/);

  // Urutannya penting: keanggotaan diperiksa sebelum 403, karena 402 juga
  // berupa penolakan dan akan tertelan oleh cabang yang lebih umum.
  assert.ok(
    source.indexOf('isMembershipRequired') < source.indexOf('error.isForbidden'),
    'cabang 402 harus mendahului cabang 403',
  );
});

test('daftar pelajaran menandai yang terkunci tanpa menyembunyikannya', async () => {
  const [source, css] = await Promise.all([
    read('../app/learn/[courseId]/[lessonId]/page.tsx'),
    read('../app/styles.css'),
  ]);

  // Daftar yang utuh adalah bagian dari penawaran; yang hilang hanya isinya.
  assert.match(source, /lesson\.locked/);
  assert.match(source, /drawerLessonLocked/);
  assert.match(source, /Perlu akses berbayar/);
  assert.match(css, /\.drawerLessonLocked \{[^}]*color: var\(--muted\)/);

  // Tetap sebuah tautan: membukanya mengantar ke penawaran, bukan diam.
  assert.match(source, /href=\{`\/learn\/\$\{courseId\}\/\$\{lesson\.id\}`\}/);
});

test('halaman pelajaran menyebut keadaan akun gratis di atas kurikulum', async () => {
  const [source, banner, css] = await Promise.all([
    read('../app/learn/[courseId]/[lessonId]/page.tsx'),
    read('../app/components/membership-banner.tsx'),
    read('../app/styles.css'),
  ]);

  assert.match(source, /course\.course\.entitled \? null : <MembershipBanner dari=\{path\} \/>/);
  assert.match(banner, /Ambil akses/);
  assert.match(banner, /\/register/);
  assert.match(css, /\.membershipBanner \{/);
});

test('komunitas menawarkan akses alih-alih kolom tulis yang pasti ditolak', async () => {
  const source = await read('../app/community/community-feed.tsx');

  // Kewenangan datang dari server, bukan disimpulkan antarmuka.
  assert.match(source, /canWrite: boolean/);
  assert.match(source, /const bolehTulis = canModerate \|\| subchannels\.some\(\(item\) => item\.canWrite\)/);
  assert.match(source, /const canPost = selected && \(!selected\.isReadOnly \|\| canModerate\) && bolehTulis/);

  // Kolom yang terlihat dapat diisi lalu menolak isinya adalah janji yang
  // ditarik kembali; yang ditawarkan justru jalan keluarnya.
  assert.match(source, /function AjakanAkses\(\)/);
  assert.match(source, /!bolehTulis \? <AjakanAkses \/>/);
  assert.match(source, /disabled=\{!bolehTulis\}/);
});
