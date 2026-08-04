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

/*
 * Cacat kedua dengan bentuk yang sama: token yang dipakai tetapi tidak pernah
 * didefinisikan. `var(--primary)` yang tidak ada nilainya membuat seluruh
 * deklarasi itu gugur — bukan hanya warnanya yang salah, melainkan tidak ada
 * warna sama sekali — dan tidak ada perkakas yang mengeluh. Empat token
 * (`--primary`, `--surface-2`, `--border`, `--line-strong`) pernah begitu di
 * halaman komunitas, dan cacatnya bertahan sampai seseorang menghitungnya
 * dengan tangan.
 */
const tokenTerdefinisi = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

// `var(--x, merah)` sah walau `--x` tidak ada: nilai cadangannya yang dipakai.
// Yang berbahaya hanya pemakaian tanpa cadangan.
const tokenHilang = new Set(
  [...css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)]
    .map((m) => m[1])
    .filter((nama) => !tokenTerdefinisi.has(nama)),
);

if (missing.size === 0 && tokenHilang.size === 0) {
  console.log('Seluruh kelas dan token CSS yang dipakai sudah didefinisikan.');
  process.exit(0);
}

if (missing.size > 0) {
  console.error(`${missing.size} kelas dipakai tetapi tidak pernah didefinisikan di styles.css:\n`);
  for (const [name, files] of [...missing].sort()) {
    console.error(`  .${name}`);
    for (const file of files) console.error(`      ${file}`);
  }
  console.error('\nTambahkan definisinya, atau perbaiki nama kelas yang salah ketik.');
}

if (tokenHilang.size > 0) {
  console.error(`\n${tokenHilang.size} token dipakai lewat var() tetapi tidak pernah didefinisikan:\n`);
  for (const nama of [...tokenHilang].sort()) {
    const jumlah = [...css.matchAll(new RegExp(`var\\(\\s*${nama}\\s*\\)`, 'g'))].length;
    console.error(`  ${nama}  (${jumlah}x)`);
  }
  console.error('\nDeklarasinya gugur diam-diam. Definisikan tokennya, atau beri nilai cadangan.');
}

process.exit(1);
