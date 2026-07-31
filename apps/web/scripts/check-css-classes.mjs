#!/usr/bin/env node
/**
 * Memastikan setiap kelas CSS yang dipakai komponen benar-benar didefinisikan.
 *
 * Ada satu kelas cacat yang lolos dari typecheck, lint, maupun build: kelas
 * yang tidak pernah ditulis di stylesheet. `.authPage` pernah begitu, dan
 * akibatnya halaman penerimaan undangan serta pengaturan ulang password —
 * tepat tempat pelajar berbayar membuat password pertamanya — tampil tanpa
 * gaya sama sekali. Tidak ada satu pun perkakas yang mengeluh.
 *
 * Pemeriksaan ini tidak menggantikan melihat halamannya dengan mata; ia hanya
 * menutup satu kelas kesalahan yang selama ini tidak terdeteksi sama sekali.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('../app', import.meta.url));
const stylesheet = join(appDir, 'styles.css');

/** Kelas yang datang dari luar stylesheet kita dan memang tidak perlu ada di sana. */
const EXTERNAL = new Set(['dark', 'light']);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx$/.test(entry) ? [full] : [];
  });
}

const css = readFileSync(stylesheet, 'utf8');
const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));

const missing = new Map();

for (const file of walk(appDir)) {
  const source = readFileSync(file, 'utf8');

  // Hanya className dengan nilai literal yang dapat diperiksa dengan andal.
  // Nilai hasil perhitungan dilewati alih-alih ditebak; menebak akan
  // menghasilkan peringatan palsu yang membuat pemeriksaan ini diabaikan.
  const literals = [
    ...source.matchAll(/className=(?:"([^"]*)"|\{`([^`${}]*)`\})/g),
  ].map((match) => match[1] ?? match[2] ?? '');

  for (const value of literals) {
    for (const name of value.split(/\s+/).filter(Boolean)) {
      if (defined.has(name) || EXTERNAL.has(name)) continue;
      const where = missing.get(name) ?? new Set();
      where.add(relative(appDir, file));
      missing.set(name, where);
    }
  }
}

if (missing.size === 0) {
  console.log('Seluruh kelas CSS literal yang dipakai sudah didefinisikan.');
  process.exit(0);
}

console.error(`${missing.size} kelas dipakai tetapi tidak pernah didefinisikan di styles.css:\n`);
for (const [name, files] of [...missing].sort()) {
  console.error(`  .${name}`);
  for (const file of files) console.error(`      ${file}`);
}
console.error('\nTambahkan definisinya, atau perbaiki nama kelas yang salah ketik.');
process.exit(1);
